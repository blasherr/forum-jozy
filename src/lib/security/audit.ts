import 'server-only';
import { lt } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { db } from '@/db/client';
import { auditLog, type User } from '@/db/schema';
import { clientIp, userAgent } from './request';

const clean = (value: string | undefined, max = 200) =>
  value?.replace(/[\r\n\t\0]/g, ' ').slice(0, max);

interface AuditEvent {
  action: string;
  req?: NextRequest;
  user?: Pick<User, 'id' | 'email'> | null;
  email?: string;
  target?: string;
  meta?: Record<string, unknown>;
}

/** Journal append-only : aucune route n'édite ni ne supprime d'entrée. Jamais de mot de passe ni de jeton ici. */
export async function audit(event: AuditEvent): Promise<void> {
  try {
    await db.insert(auditLog).values({
      action: clean(event.action, 80) ?? 'unknown',
      userId: event.user?.id,
      userEmail: clean(event.user?.email ?? event.email, 254),
      target: clean(event.target),
      ip: event.req ? clientIp(event.req) : null,
      userAgent: event.req ? userAgent(event.req) : null,
      meta: event.meta ?? null,
    });
  } catch {
    console.error('[audit] écriture impossible');
  }
}

/** Conservation limitée à 365 jours (minimisation des données personnelles). */
export async function purgeOldAudit(): Promise<void> {
  await db.delete(auditLog).where(lt(auditLog.at, Date.now() - 365 * 24 * 3600 * 1000));
}
