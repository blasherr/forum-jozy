import 'server-only';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { hmac, safeEqual } from './crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const idx = ALPHABET.indexOf(char);
    if (idx < 0) throw new Error('base32 invalide');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 15;
  const code = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(code % 10 ** digits).padStart(digits, '0');
}

export const newTotpSecret = (): string => base32Encode(randomBytes(20));

export const currentStep = (now = Date.now()): number => Math.floor(now / 30000);

/**
 * Vérifie un code à ±1 pas de 30 s. Renvoie le pas validé, ou null.
 * Un pas déjà utilisé (lastStep) est refusé : un code intercepté ne peut pas être rejoué.
 */
export function verifyTotp(base32Secret: string, code: string, lastStep: number, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = base32Decode(base32Secret);
  const step = currentStep(now);
  let found: number | null = null;
  // Toutes les fenêtres sont testées pour garder un temps constant.
  for (const candidate of [step - 1, step, step + 1]) {
    if (safeEqual(hotp(secret, candidate), code) && candidate > lastStep) found = candidate;
  }
  return found;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Codes de secours : affichés une seule fois, seule leur empreinte est conservée. */
export function newRecoveryCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain = Array.from({ length: count }, () => {
    let code = '';
    for (let i = 0; i < 12; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`;
  });
  return { plain, hashed: plain.map(hashRecoveryCode) };
}

export const hashRecoveryCode = (code: string): string =>
  hmac('recovery', code.toUpperCase().replace(/[^A-Z0-9]/g, ''));
