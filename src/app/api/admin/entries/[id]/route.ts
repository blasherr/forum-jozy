import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { revisions, users } from '@/db/schema';
import { deleteEntry, updateEntry } from '@/lib/content/mutations';
import { getEntryById } from '@/lib/content/queries';
import { entryInputSchema } from '@/lib/content/schemas';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { HttpError, json, readJson } from '@/lib/security/request';

type Params = { id: string };

const id = z.string().uuid();
const assertId = (value: string) => {
  if (!id.safeParse(value).success) throw new HttpError(404, 'not_found', 'Contenu introuvable.');
};

export const GET = adminRoute<Params>({ role: 'editor' }, async ({ params }) => {
  assertId(params.id);
  const entry = await getEntryById(params.id);
  if (!entry) throw new HttpError(404, 'not_found', 'Contenu introuvable.');
  const history = await db
    .select({ id: revisions.id, createdAt: revisions.createdAt, note: revisions.note, author: users.name })
    .from(revisions)
    .leftJoin(users, eq(revisions.createdBy, users.id))
    .where(eq(revisions.subject, `entry:${params.id}`))
    .orderBy(desc(revisions.createdAt))
    .limit(40);
  return json({ entry, history });
});

export const PUT = adminRoute<Params>({ role: 'editor' }, async ({ req, params, user }) => {
  assertId(params.id);
  const input = await readJson(req, entryInputSchema, 1024 * 1024);
  await updateEntry(params.id, input, user.id);
  await audit({ action: 'entry.update', req, user, target: params.id, meta: { status: input.status } });
  return json({ ok: true });
});

export const DELETE = adminRoute<Params>({ role: 'admin' }, async ({ req, params, user }) => {
  assertId(params.id);
  await deleteEntry(params.id, user.id);
  await audit({ action: 'entry.delete', req, user, target: params.id });
  return json({ ok: true });
});
