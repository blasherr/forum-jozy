import { IdentityForm } from '@/components/admin/settings-forms';
import { getSetting } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminIdentity() {
  await requirePage('admin');
  return <IdentityForm initial={await getSetting('site')} />;
}
