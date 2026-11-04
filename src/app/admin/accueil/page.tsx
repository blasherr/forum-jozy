import { HomeForm } from '@/components/admin/settings-forms';
import { getSetting } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminHome() {
  await requirePage();
  return <HomeForm initial={await getSetting('home')} />;
}
