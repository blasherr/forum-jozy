import 'server-only';
import { and, eq, lt } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/db/client';
import { sessions, users, type User } from '@/db/schema';
import { audit, purgeOldAudit } from './audit';
import { decrypt, safeEqual } from './crypto';
import { limitKey } from './ip';
import { verifyPassword } from './password';
import { clearLimit, hit, purgeExpiredLimits } from './ratelimit';
import { clientIp, HttpError, userAgent } from './request';
import { createSession, purgeExpiredSessions } from './session';
import { hashRecoveryCode, verifyTotp } from './totp';

export const loginSchema = z
  .object({
    email: z.string().trim().min(3).max(254),
    password: z.string().min(1).max(256),
  })
  .strict();

export const normalizeEmail = (value: string): string => value.normalize('NFKC').trim().toLowerCase();

const GENERIC = 'Identifiants invalides, ou accès temporairement suspendu.';
const WINDOW_MS = 15 * 60 * 1000;

const tooMany = (retryAfter: number) =>
  new HttpError(429, 'rate_limited', 'Trop de tentatives. Réessayez plus tard.', {
    'Retry-After': String(retryAfter),
  });

/**
 * Connexion. Plafonds par IP et par couple IP/compte, plus un plafond large par compte contre les
 * attaques distribuées. Il n'y a volontairement pas de verrouillage strict du compte : il offrirait à
 * n'importe qui le moyen d'empêcher le propriétaire de se connecter, alors que la 2FA obligatoire
 * rend déjà le mot de passe seul insuffisant.
 * Le traitement d'un échec est identique que le compte existe ou non : ni le message ni la durée
 * ne révèlent quoi que ce soit.
 */
export async function login(req: NextRequest, email: string, password: string): Promise<{ mfa: boolean }> {
  const ip = clientIp(req);
  const bucket = limitKey(ip);
  const normalized = normalizeEmail(email);

  const byIp = await hit('login-ip', bucket, ip === 'direct' ? 200 : 20, WINDOW_MS);
  if (!byIp.allowed) throw tooMany(byIp.retryAfter);
  const byPair = await hit('login-pair', `${bucket}|${normalized}`, 6, WINDOW_MS);
  if (!byPair.allowed) throw tooMany(byPair.retryAfter);
  const byAccount = await hit('login-account', normalized, 200, 60 * 60 * 1000);
  if (!byAccount.allowed) throw tooMany(byAccount.retryAfter);

  const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  const user = rows[0];

  let valid = false;
  try {
    valid = await verifyPassword(user?.passwordHash ?? null, password);
  } catch {
    throw new HttpError(503, 'busy', 'Service occupé, réessayez.');
  }

  if (!user || !valid || user.disabled) {
    await audit({ action: 'auth.failed', req, email: normalized.slice(0, 254) });
    throw new HttpError(401, 'invalid', GENERIC);
  }

  await Promise.all([clearLimit('login-pair', `${bucket}|${normalized}`), clearLimit('login-account', normalized)]);

  const mfa = user.totpEnabled;
  await createSession(user.id, { mfaPassed: !mfa, ip, userAgent: userAgent(req) });
  if (!mfa) await afterLogin(req, user);

  // Ménage opportuniste : ni cron ni tâche planifiée à exposer.
  if (Math.random() < 0.05) {
    await Promise.all([purgeExpiredSessions(), purgeExpiredLimits(), purgeOldAudit()]).catch(() => undefined);
  }
  return { mfa };
}

export async function afterLogin(req: NextRequest, user: User): Promise<void> {
  await db.update(users).set({ lastLoginAt: Date.now() }).where(eq(users.id, user.id));
  await audit({ action: 'auth.login', req, user });
}

/** Vérifie un code TOTP ou un code de secours à usage unique. */
export async function checkSecondFactor(user: User, code: string): Promise<'totp' | 'recovery' | null> {
  const clean = code.trim();
  if (user.totpSecret && /^\d{6}$/.test(clean)) {
    const secret = decrypt(user.totpSecret, user.id);
    const step = verifyTotp(secret, clean, user.totpLastStep);
    if (step === null) return null;
    // Écriture conditionnelle : deux requêtes simultanées avec le même code n'en valident qu'une.
    const claimed = await db
      .update(users)
      .set({ totpLastStep: step })
      .where(and(eq(users.id, user.id), lt(users.totpLastStep, step)))
      .returning({ id: users.id });
    return claimed.length > 0 ? 'totp' : null;
  }
  const hashed = hashRecoveryCode(clean);
  const match = user.recoveryCodes.find((c) => safeEqual(c, hashed));
  if (!match) return null;
  // Même logique : un code de secours ne peut être consommé qu'une fois, même en parallèle.
  const claimed = await db
    .update(users)
    .set({ recoveryCodes: user.recoveryCodes.filter((c) => c !== match) })
    .where(and(eq(users.id, user.id), eq(users.recoveryCodes, user.recoveryCodes)))
    .returning({ id: users.id });
  return claimed.length > 0 ? 'recovery' : null;
}

export async function dropSession(idHash: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.idHash, idHash));
}
