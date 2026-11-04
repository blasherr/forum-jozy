import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { revisions } from '@/db/schema';
import { saveSetting } from '@/lib/content/mutations';
import { settingSchemas, type SettingKey } from '@/lib/content/schemas';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { HttpError, json, readJson } from '@/lib/security/request';

const schema = z.object({ revisionId: z.string().uuid() }).strict();

export const POST = adminRoute<{ key: string }>({ role: 'admin' }, async ({ req, params, user }) => {
  const { key } = params;
  if (!Object.hasOwn(settingSchemas, key)) throw new HttpError(404, 'not_found', 'Réglage inconnu.');
  const { revisionId } = await readJson(req, schema, 512);
  const rows = await db
    .select()
    .from(revisions)
    .where(and(eq(revisions.id, revisionId), eq(revisions.subject, `setting:${key}`)))
    .limit(1);
  const revision = rows[0];
  if (!revision) throw new HttpError(404, 'not_found', 'Version introuvable.');
  const parsed = settingSchemas[key as SettingKey].safeParse(revision.snapshot);
  if (!parsed.success) throw new HttpError(422, 'validation', 'Version illisible.');
  await saveSetting(key as SettingKey, parsed.data, user.id);
  await audit({ action: 'setting.restore', req, user, target: key });
  return json({ ok: true });
});
