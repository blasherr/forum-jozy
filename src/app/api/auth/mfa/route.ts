import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { afterLogin, checkSecondFactor, dropSession } from '@/lib/security/auth';
import { audit } from '@/lib/security/audit';
import { hit } from '@/lib/security/ratelimit';
import { assertSameOrigin, clientIp, errorResponse, HttpError, json, readJson, userAgent } from '@/lib/security/request';
import { createSession, getPendingAuth } from '@/lib/security/session';

const schema = z.object({ code: z.string().trim().min(6).max(20) }).strict();

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const pending = await getPendingAuth();
    if (!pending) throw new HttpError(401, 'unauthorized', 'Session expirée. Recommencez la connexion.');

    const limit = await hit('mfa', pending.user.id, 5, 10 * 60 * 1000);
    if (!limit.allowed) {
      // Trop d'essais : la session intermédiaire est détruite, il faut repasser par le mot de passe.
      await dropSession(pending.session.idHash);
      throw new HttpError(429, 'rate_limited', 'Trop d’essais. Recommencez la connexion.', {
        'Retry-After': String(limit.retryAfter),
      });
    }

    const { code } = await readJson(req, schema, 256);
    const method = await checkSecondFactor(pending.user, code);
    if (!method) {
      await audit({ action: 'auth.mfa_failed', req, user: pending.user });
      throw new HttpError(401, 'invalid', 'Code invalide.');
    }

    // Nouveau jeton : la session partielle ne devient jamais une session complète.
    await dropSession(pending.session.idHash);
    await createSession(pending.user.id, { mfaPassed: true, ip: clientIp(req), userAgent: userAgent(req) });
    await afterLogin(req, pending.user);
    if (method === 'recovery') await audit({ action: 'auth.recovery_used', req, user: pending.user });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
