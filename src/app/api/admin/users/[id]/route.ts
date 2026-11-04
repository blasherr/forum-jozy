import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { sessions, users } from '@/db/schema';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { HttpError, json, readJson } from '@/lib/security/request';

type Params = { id: string };
const uuid = z.string().uuid();

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    role: z.enum(['admin', 'editor']).optional(),
    disabled: z.boolean().optional(),
  })
  .strict();

async function target(id: string, selfId: string) {
  if (!uuid.safeParse(id).success) throw new HttpError(404, 'not_found', 'Compte introuvable.');
  if (id === selfId) throw new HttpError(400, 'self', 'Utilisez la page « Mon compte » pour votre propre compte.');
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new HttpError(404, 'not_found', 'Compte introuvable.');
  if (row.role === 'owner') throw new HttpError(403, 'forbidden', 'Un compte propriétaire ne peut pas être modifié ici.');
  return row;
}

export const PATCH = adminRoute<Params>({ role: 'owner', sudo: true }, async ({ req, params, user }) => {
  const row = await target(params.id, user.id);
  const input = await readJson(req, patchSchema, 1024);
  await db
    .update(users)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(users.id, row.id));
  // Un changement de droits ferme les sessions ouvertes : pas de droits périmés.
  if (input.disabled || input.role) await db.delete(sessions).where(eq(sessions.userId, row.id));
  await audit({ action: 'user.update', req, user, target: row.email, meta: input });
  return json({ ok: true });
});

export const DELETE = adminRoute<Params>({ role: 'owner', sudo: true }, async ({ req, params, user }) => {
  const row = await target(params.id, user.id);
  await db.delete(users).where(and(eq(users.id, row.id)));
  await audit({ action: 'user.delete', req, user, target: row.email });
  return json({ ok: true });
});
