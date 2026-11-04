import { DiscordForm } from '@/components/admin/settings-forms';
import { getSetting } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminDiscord() {
  await requirePage();
  return <DiscordForm initial={await getSetting('discord')} />;
}
