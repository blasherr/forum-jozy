import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { json } from '@/lib/security/request';
import { destroySession } from '@/lib/security/session';

export const POST = adminRoute({ account: true }, async ({ req, session, user }) => {
  await destroySession(session.idHash);
  await audit({ action: 'auth.logout', req, user });
  // Efface aussi les données du navigateur liées au site.
  return json({ ok: true }, 200, { 'Clear-Site-Data': '"cache", "storage"' });
});
