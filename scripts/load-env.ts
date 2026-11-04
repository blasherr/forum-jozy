import { existsSync, readFileSync } from 'node:fs';

/** Charge .env.local pour les scripts en ligne de commande. */
export function loadEnv(): void {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (m?.[1] && m[2] !== undefined) process.env[m[1]] ??= m[2];
  }
}
