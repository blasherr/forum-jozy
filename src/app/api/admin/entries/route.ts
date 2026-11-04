import { z } from 'zod';
import { COLLECTIONS } from '@/db/schema';
import { createEntry, reorderEntries } from '@/lib/content/mutations';
import { entryInputSchema } from '@/lib/content/schemas';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { json, readJson } from '@/lib/security/request';

const MAX_DOC = 1024 * 1024;

const createSchema = z.object({ collection: z.enum(COLLECTIONS), entry: entryInputSchema }).strict();

export const POST = adminRoute({ role: 'editor' }, async ({ req, user }) => {
  const { collection, entry } = await readJson(req, createSchema, MAX_DOC);
  const id = await createEntry(collection, entry, user.id);
  await audit({ action: 'entry.create', req, user, target: `${collection}/${entry.slug}` });
  return json({ ok: true, id }, 201);
});

const reorderSchema = z
  .object({ collection: z.enum(COLLECTIONS), ids: z.array(z.string().uuid()).max(500) })
  .strict();

export const PATCH = adminRoute({ role: 'editor' }, async ({ req, user }) => {
  const { collection, ids } = await readJson(req, reorderSchema, 64 * 1024);
  await reorderEntries(collection, ids);
  await audit({ action: 'entry.reorder', req, user, target: collection });
  return json({ ok: true });
});
