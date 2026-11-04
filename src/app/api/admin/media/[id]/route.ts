import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { media } from '@/db/schema';
import { bumpVersion } from '@/lib/content/mutations';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { HttpError, json, readJson } from '@/lib/security/request';

type Params = { id: string };
const uuid = z.string().uuid();
const patchSchema = z.object({ alt: z.string().trim().max(300) }).strict();

export const PATCH = adminRoute<Params>({ role: 'editor' }, async ({ req, params, user }) => {
  if (!uuid.safeParse(params.id).success) throw new HttpError(404, 'not_found', 'Introuvable.');
  const { alt } = await readJson(req, patchSchema, 1024);
  await db.update(media).set({ alt }).where(eq(media.id, params.id));
  await audit({ action: 'media.update', req, user, target: params.id });
  return json({ ok: true });
});

export const DELETE = adminRoute<Params>({ role: 'admin' }, async ({ req, params, user }) => {
  if (!uuid.safeParse(params.id).success) throw new HttpError(404, 'not_found', 'Introuvable.');
  await db.delete(media).where(eq(media.id, params.id));
  await bumpVersion();
  await audit({ action: 'media.delete', req, user, target: params.id });
  return json({ ok: true });
});
