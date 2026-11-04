import { PagesForm } from '@/components/admin/settings-forms';
import { getSetting } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminTexts() {
  await requirePage();
  return <PagesForm initial={await getSetting('pages')} />;
}
