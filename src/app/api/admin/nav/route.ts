import { saveNav } from '@/lib/content/mutations';
import { navInputSchema } from '@/lib/content/schemas';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { json, readJson } from '@/lib/security/request';

export const PUT = adminRoute({ role: 'admin' }, async ({ req, user }) => {
  const { items } = await readJson(req, navInputSchema, 16 * 1024);
  await saveNav(items);
  await audit({ action: 'nav.update', req, user, meta: { count: items.length } });
  return json({ ok: true });
});
