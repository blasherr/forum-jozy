import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { revisions } from '@/db/schema';
import { saveSetting } from '@/lib/content/mutations';
import { settingSchemas, type SettingKey } from '@/lib/content/schemas';
import { audit } from '@/lib/security/audit';
import { adminRoute, type Role } from '@/lib/security/guard';
import { HttpError, json, readJson } from '@/lib/security/request';

const isKey = (key: string): key is SettingKey => Object.hasOwn(settingSchemas, key);

/** Le thème et l'identité du site sont réservés aux administrateurs ; les textes aux rédacteurs. */
const MIN_ROLE: Record<SettingKey, Role> = {
  home: 'editor',
  pages: 'editor',
  discord: 'editor',
  site: 'admin',
  theme: 'admin',
};

export const PUT = adminRoute<{ key: string }>({ role: 'editor' }, async ({ req, params, user }) => {
  const { key } = params;
  if (!isKey(key)) throw new HttpError(404, 'not_found', 'Réglage inconnu.');
  const rank = { editor: 1, admin: 2, owner: 3 };
  if (rank[user.role] < rank[MIN_ROLE[key]]) throw new HttpError(403, 'forbidden', 'Droits insuffisants.');
  const value = await readJson(req, settingSchemas[key], 512 * 1024);
  await saveSetting(key, value, user.id);
  await audit({ action: 'setting.update', req, user, target: key });
  return json({ ok: true });
});

export const GET = adminRoute<{ key: string }>({ role: 'editor' }, async ({ params }) => {
  const { key } = params;
  if (!isKey(key)) throw new HttpError(404, 'not_found', 'Réglage inconnu.');
  const rows = await db
    .select({ id: revisions.id, createdAt: revisions.createdAt, createdBy: revisions.createdBy })
    .from(revisions)
    .where(eq(revisions.subject, `setting:${key}`))
    .orderBy(desc(revisions.createdAt))
    .limit(40);
  return json({ revisions: rows });
});
