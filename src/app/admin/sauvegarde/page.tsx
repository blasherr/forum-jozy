import { BackupPanel } from '@/components/admin/BackupPanel';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminBackup() {
  await requirePage('owner');
  return <BackupPanel />;
}
