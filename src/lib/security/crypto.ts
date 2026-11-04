import 'server-only';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { env } from '@/env';

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/** HMAC séparé par usage : un jeton d'un contexte n'est jamais valable dans un autre. */
export function hmac(purpose: string, value: string): string {
  return createHmac('sha256', Buffer.from(env.SESSION_SECRET, 'base64'))
    .update(purpose)
    .update('\0')
    .update(value)
    .digest('base64url');
}

/** Comparaison à temps constant, y compris quand les longueurs diffèrent. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

const key = () => Buffer.from(env.ENCRYPTION_KEY, 'base64').subarray(0, 32);

/** AES-256-GCM. `aad` lie le chiffré à son propriétaire : on ne peut pas le déplacer d'un compte à l'autre. */
export function encrypt(plain: string, aad: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
}

export function decrypt(payload: string, aad: string): string {
  const [v, iv, tag, data] = payload.split('.');
  if (v !== 'v1' || !iv || !tag || data === undefined) throw new Error('chiffré invalide');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
