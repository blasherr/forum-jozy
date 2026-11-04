import { ThemeForm } from '@/components/admin/settings-forms';
import { DEFAULT_SETTINGS } from '@/lib/content/defaults';
import { getSetting } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminTheme() {
  await requirePage('admin');
  return <ThemeForm initial={await getSetting('theme')} defaults={DEFAULT_SETTINGS.theme} />;
}
