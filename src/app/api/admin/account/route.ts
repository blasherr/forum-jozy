import { and, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { sessions, users } from '@/db/schema';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { checkPassword, hashPassword, verifyPassword } from '@/lib/security/password';
import { hit } from '@/lib/security/ratelimit';
import { clientIp, HttpError, json, readJson, userAgent } from '@/lib/security/request';
import { createSession, destroyAllSessions, destroyOtherSessions } from '@/lib/security/session';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sudo'), password: z.string().min(1).max(256) }).strict(),
  z
    .object({
      action: z.literal('password'),
      current: z.string().min(1).max(256),
      next: z.string().min(1).max(256),
    })
    .strict(),
  z.object({ action: z.literal('profile'), name: z.string().trim().min(1).max(80) }).strict(),
  z.object({ action: z.literal('revoke-others') }).strict(),
  z.object({ action: z.literal('revoke'), sessionHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
]);

async function requirePassword(userId: string, hash: string, password: string) {
  const limit = await hit('reauth', userId, 8, 15 * 60 * 1000);
  if (!limit.allowed) throw new HttpError(429, 'rate_limited', 'Trop de tentatives.');
  if (!(await verifyPassword(hash, password))) {
    throw new HttpError(401, 'invalid', 'Mot de passe incorrect.');
  }
}

export const GET = adminRoute({ account: true }, async ({ user, session }) => {
  const rows = await db
    .select({
      idHash: sessions.idHash,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), eq(sessions.mfaPassed, true)))
    .orderBy(desc(sessions.lastSeenAt))
    .limit(30);
  return json({ sessions: rows.map((s) => ({ ...s, current: s.idHash === session.idHash })) });
});

export const POST = adminRoute({ account: true }, async ({ req, user, session }) => {
  const input = await readJson(req, schema, 2048);
  switch (input.action) {
    case 'sudo': {
      await requirePassword(user.id, user.passwordHash, input.password);
      await db
        .update(sessions)
        .set({ sudoUntil: Date.now() + 10 * 60 * 1000 })
        .where(eq(sessions.idHash, session.idHash));
      await audit({ action: 'auth.sudo', req, user });
      return json({ ok: true });
    }
    case 'password': {
      await requirePassword(user.id, user.passwordHash, input.current);
      const problem = checkPassword(input.next, [user.email, user.name]);
      if (problem) throw new HttpError(422, 'weak_password', problem);
      if (await verifyPassword(user.passwordHash, input.next)) {
        throw new HttpError(422, 'same_password', 'Choisissez un mot de passe différent de l’actuel.');
      }
      await db
        .update(users)
        .set({ passwordHash: await hashPassword(input.next), mustChangePassword: false, updatedAt: Date.now() })
        .where(eq(users.id, user.id));
      // Toutes les sessions tombent, y compris la courante : un cookie volé avant le changement ne vaut plus rien.
      await destroyAllSessions(user.id);
      await createSession(user.id, { mfaPassed: true, ip: clientIp(req), userAgent: userAgent(req) });
      await audit({ action: 'account.password', req, user });
      return json({ ok: true });
    }
    case 'profile': {
      await db.update(users).set({ name: input.name, updatedAt: Date.now() }).where(eq(users.id, user.id));
      await audit({ action: 'account.profile', req, user });
      return json({ ok: true });
    }
    case 'revoke-others': {
      await destroyOtherSessions(user.id, session.idHash);
      await audit({ action: 'account.sessions_revoked', req, user });
      return json({ ok: true });
    }
    case 'revoke': {
      if (input.sessionHash === session.idHash) {
        throw new HttpError(400, 'current', 'Utilisez « Se déconnecter » pour cette session.');
      }
      await db
        .delete(sessions)
        .where(and(eq(sessions.idHash, input.sessionHash), eq(sessions.userId, user.id), ne(sessions.idHash, session.idHash)));
      await audit({ action: 'account.sessions_revoked', req, user });
      return json({ ok: true });
    }
  }
});
