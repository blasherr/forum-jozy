import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { revisions, type Entry } from '@/db/schema';
import { updateEntry } from '@/lib/content/mutations';
import { entryInputSchema } from '@/lib/content/schemas';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { HttpError, json, readJson } from '@/lib/security/request';

const schema = z.object({ revisionId: z.string().uuid() }).strict();

export const POST = adminRoute<{ id: string }>({ role: 'editor' }, async ({ req, params, user }) => {
  if (!z.string().uuid().safeParse(params.id).success) throw new HttpError(404, 'not_found', 'Introuvable.');
  const { revisionId } = await readJson(req, schema, 512);
  const rows = await db
    .select()
    .from(revisions)
    .where(and(eq(revisions.id, revisionId), eq(revisions.subject, `entry:${params.id}`)))
    .limit(1);
  const revision = rows[0];
  if (!revision) throw new HttpError(404, 'not_found', 'Version introuvable.');

  // Une ancienne version repasse par la validation complète, comme une saisie normale.
  const old = revision.snapshot as Entry;
  const parsed = entryInputSchema.safeParse({
    title: old.title,
    slug: old.slug,
    summary: old.summary,
    body: old.body,
    meta: old.meta,
    status: old.status,
    publishedAt: old.publishedAt,
    note: 'Restauration',
  });
  if (!parsed.success) throw new HttpError(422, 'validation', 'Version illisible.');
  await updateEntry(params.id, parsed.data, user.id);
  await audit({ action: 'entry.restore', req, user, target: params.id });
  return json({ ok: true });
});
