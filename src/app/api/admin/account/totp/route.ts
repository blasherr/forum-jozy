import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { getSetting } from '@/lib/content/queries';
import { audit } from '@/lib/security/audit';
import { checkSecondFactor } from '@/lib/security/auth';
import { decrypt, encrypt } from '@/lib/security/crypto';
import { adminRoute } from '@/lib/security/guard';
import { verifyPassword } from '@/lib/security/password';
import { hit } from '@/lib/security/ratelimit';
import { HttpError, json, readJson } from '@/lib/security/request';
import { destroyOtherSessions } from '@/lib/security/session';
import { newRecoveryCodes, newTotpSecret, otpauthUri, verifyTotp } from '@/lib/security/totp';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }).strict(),
  z.object({ action: z.literal('confirm'), code: z.string().trim().length(6) }).strict(),
  z.object({ action: z.literal('recovery'), code: z.string().trim().min(6).max(20) }).strict(),
  z
    .object({
      action: z.literal('disable'),
      password: z.string().min(1).max(256),
      code: z.string().trim().min(6).max(20),
    })
    .strict(),
]);

/** Le QR code est renvoyé en matrice de modules et dessiné en SVG côté client, sans HTML ni URI data:. */
function qrMatrix(text: string) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  return { size: qr.modules.size, cells: Array.from(qr.modules.data) };
}

export const POST = adminRoute({ account: true }, async ({ req, user, session }) => {
  const input = await readJson(req, schema, 1024);
  const limit = await hit('totp-manage', user.id, 15, 15 * 60 * 1000);
  if (!limit.allowed) throw new HttpError(429, 'rate_limited', 'Trop de tentatives.');

  switch (input.action) {
    case 'start': {
      if (user.totpEnabled) throw new HttpError(409, 'already', 'La double authentification est déjà active.');
      // Sans ce contrôle, une session volée pourrait enrôler son propre téléphone et évincer le titulaire.
      if (session.sudoUntil <= Date.now()) throw new HttpError(403, 'sudo_required', 'Confirmez votre mot de passe.');
      const secret = newTotpSecret();
      await db
        .update(users)
        .set({ totpSecret: encrypt(secret, user.id), totpEnabled: false, totpLastStep: 0 })
        .where(eq(users.id, user.id));
      const site = await getSetting('site');
      return json({ secret, qr: qrMatrix(otpauthUri(secret, user.email, site.shortName)) });
    }
    case 'confirm': {
      if (user.totpEnabled || !user.totpSecret) throw new HttpError(409, 'state', 'Recommencez l’activation.');
      const step = verifyTotp(decrypt(user.totpSecret, user.id), input.code, 0);
      if (step === null) throw new HttpError(422, 'invalid', 'Code invalide. Vérifiez l’heure de votre téléphone.');
      const { plain, hashed } = newRecoveryCodes();
      await db
        .update(users)
        .set({ totpEnabled: true, totpLastStep: step, recoveryCodes: hashed })
        .where(eq(users.id, user.id));
      // Les sessions ouvertes avant l'activation n'ont jamais passé le second facteur.
      await destroyOtherSessions(user.id, session.idHash);
      await audit({ action: 'account.2fa_enabled', req, user });
      return json({ ok: true, recoveryCodes: plain });
    }
    case 'recovery': {
      if (!user.totpEnabled) throw new HttpError(409, 'state', 'La double authentification n’est pas active.');
      if (!(await checkSecondFactor(user, input.code))) throw new HttpError(422, 'invalid', 'Code invalide.');
      const { plain, hashed } = newRecoveryCodes();
      await db.update(users).set({ recoveryCodes: hashed }).where(eq(users.id, user.id));
      await audit({ action: 'account.recovery_regenerated', req, user });
      return json({ ok: true, recoveryCodes: plain });
    }
    case 'disable': {
      if (!user.totpEnabled) throw new HttpError(409, 'state', 'La double authentification n’est pas active.');
      if (!(await verifyPassword(user.passwordHash, input.password))) {
        throw new HttpError(401, 'invalid', 'Mot de passe incorrect.');
      }
      if (!(await checkSecondFactor(user, input.code))) throw new HttpError(422, 'invalid', 'Code invalide.');
      await db
        .update(users)
        .set({ totpEnabled: false, totpSecret: null, totpLastStep: 0, recoveryCodes: [] })
        .where(eq(users.id, user.id));
      await destroyOtherSessions(user.id, session.idHash);
      await audit({ action: 'account.2fa_disabled', req, user });
      return json({ ok: true });
    }
  }
});

/** Sert seulement à confirmer que la clé stockée reste lisible. */
export const GET = adminRoute({ account: true }, async ({ user }) => {
  let readable = false;
  if (user.totpSecret) {
    try {
      decrypt(user.totpSecret, user.id);
      readable = true;
    } catch {
      readable = false;
    }
  }
  return json({ enabled: user.totpEnabled, readable, recoveryLeft: user.recoveryCodes.length });
});
