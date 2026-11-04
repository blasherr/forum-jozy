import 'server-only';
import { and, eq, lt, ne } from 'drizzle-orm';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { db, dbReady } from '@/db/client';
import { sessions, users, type Session, type User } from '@/db/schema';
import { env } from '@/env';
import { hmac, randomToken, safeEqual, sha256 } from './crypto';

export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const PENDING_MS = 5 * 60 * 1000;

/** Le préfixe __Host- impose Secure, Path=/ et aucun Domain : le cookie ne peut pas être posé par un sous-domaine. */
export const cookieName = () => (env.isProd ? '__Host-nf_session' : 'nf_session');

export interface AuthContext {
  user: User;
  session: Session;
  csrf: string;
}

async function writeCookie(token: string, maxAgeMs: number) {
  const jar = await cookies();
  jar.set({
    name: cookieName(),
    value: token,
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  });
}

export async function clearCookie() {
  const jar = await cookies();
  jar.set({
    name: cookieName(),
    value: '',
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
}

/** Nouveau jeton à chaque connexion (anti-fixation) ; seule son empreinte est stockée. */
export async function createSession(
  userId: string,
  opts: { mfaPassed: boolean; ip: string; userAgent: string },
): Promise<void> {
  const token = randomToken(32);
  const now = Date.now();
  const lifetime = opts.mfaPassed ? ABSOLUTE_MS : PENDING_MS;
  await db.insert(sessions).values({
    idHash: sha256(token),
    userId,
    mfaPassed: opts.mfaPassed,
    createdAt: now,
    lastSeenAt: now,
    idleExpiresAt: now + (opts.mfaPassed ? IDLE_MS : PENDING_MS),
    expiresAt: now + lifetime,
    ip: opts.ip,
    userAgent: opts.userAgent,
  });
  await writeCookie(token, lifetime);
}

const loadSession = cache(async (): Promise<{ user: User; session: Session } | null> => {
  await dbReady();
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (!token || token.length > 128) return null;

  const idHash = sha256(token);
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.idHash, idHash))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const now = Date.now();
  const h = await headers();
  const ua = (h.get('user-agent') ?? '').replace(/[\r\n\t\0]/g, ' ').slice(0, 300);
  const stale = row.session.expiresAt <= now || row.session.idleExpiresAt <= now;
  // Un cookie volé puis rejoué depuis un autre navigateur ne fonctionne pas.
  const moved = row.session.userAgent !== null && !safeEqual(row.session.userAgent, ua);
  if (stale || moved || row.user.disabled) {
    await db.delete(sessions).where(eq(sessions.idHash, idHash));
    return null;
  }

  if (row.session.mfaPassed && now - row.session.lastSeenAt > 60_000) {
    const idleExpiresAt = Math.min(now + IDLE_MS, row.session.expiresAt);
    await db.update(sessions).set({ lastSeenAt: now, idleExpiresAt }).where(eq(sessions.idHash, idHash));
    row.session.lastSeenAt = now;
    row.session.idleExpiresAt = idleExpiresAt;
  }
  return row;
});

/** Session complète, 2FA passée incluse. C'est le seul point d'entrée pour tout ce qui est protégé. */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const row = await loadSession();
  if (!row || !row.session.mfaPassed) return null;
  return { ...row, csrf: csrfFor(row.session.idHash) };
});

/** Session en attente du second facteur. */
export const getPendingAuth = cache(async () => {
  const row = await loadSession();
  return row && !row.session.mfaPassed ? row : null;
});

export const csrfFor = (idHash: string): string => hmac('csrf', idHash);

export const verifyCsrf = (idHash: string, token: string | null): boolean =>
  token !== null && token.length < 128 && safeEqual(csrfFor(idHash), token);

export async function completeMfa(idHash: string): Promise<void> {
  // Le jeton est remplacé au passage du second facteur : une session « en attente » ne devient jamais pleine.
  await db.delete(sessions).where(eq(sessions.idHash, idHash));
}

export async function destroySession(idHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, idHash));
  await clearCookie();
}

export async function destroyOtherSessions(userId: string, keepIdHash: string): Promise<void> {
  await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.idHash, keepIdHash)));
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, Date.now()));
}
