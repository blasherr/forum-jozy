import 'server-only';
import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { env } from '@/env';
import { checkPassword } from './password-policy';

export { checkPassword };

/** Argon2id : 64 Mio, 3 passes (au-dessus du minimum OWASP). 2 = Algorithm.Argon2id. */
const params = () => ({
  algorithm: 2 as const,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32,
  // Poivre gardé hors de la base : un vol de la base seule ne permet aucun cassage hors ligne.
  secret: Buffer.from(env.PASSWORD_PEPPER, 'base64'),
});

/** Limite le nombre de hachages simultanés : l'Argon2 ne peut pas servir à saturer la RAM. */
const MAX_CONCURRENT = 4;
const MAX_QUEUE = 32;
let running = 0;
const queue: Array<() => void> = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) {
    if (queue.length >= MAX_QUEUE) throw new Error('auth-saturated');
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running += 1;
  try {
    return await fn();
  } finally {
    running -= 1;
    queue.shift()?.();
  }
}

export const hashPassword = (password: string): Promise<string> => slot(() => hash(password, params()));

let dummy: Promise<string> | undefined;

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  // Compte inconnu : on fait quand même le calcul, pour que la durée ne révèle rien.
  dummy ??= hashPassword(randomBytes(32).toString('base64'));
  const target = stored ?? (await dummy);
  const ok = await slot(() => verify(target, password, params()).catch(() => false));
  return stored !== null && ok;
}
