import 'server-only';
import { eq, lt, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { rateLimits } from '@/db/schema';
import { hmac } from './crypto';

export interface LimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

/**
 * Compteur à fenêtre fixe stocké en base : il survit aux redémarrages et fonctionne
 * à plusieurs instances. L'incrément est atomique. La clé est hachée : ni e-mail ni IP en clair.
 */
export async function hit(scope: string, value: string, limit: number, windowMs: number): Promise<LimitResult> {
  const key = hmac('ratelimit', `${scope}|${value}`);
  const now = Date.now();
  const reset = now + windowMs;
  const rows = await db.all<{ count: number; reset_at: number }>(sql`
    INSERT INTO rate_limits (key, count, reset_at) VALUES (${key}, 1, ${reset})
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN rate_limits.reset_at <= ${now} THEN 1 ELSE rate_limits.count + 1 END,
      reset_at = CASE WHEN rate_limits.reset_at <= ${now} THEN ${reset} ELSE rate_limits.reset_at END
    RETURNING count, reset_at
  `);
  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const resetAt = Number(row?.reset_at ?? reset);
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export async function clearLimit(scope: string, value: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, hmac('ratelimit', `${scope}|${value}`)));
}

export async function purgeExpiredLimits(): Promise<void> {
  await db.delete(rateLimits).where(lt(rateLimits.resetAt, Date.now()));
}
