import { AccountSettings } from '@/components/admin/AccountSettings';
import { env } from '@/env';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminAccount() {
  const { user } = await requirePage('editor', { account: true });
  return (
    <AccountSettings
      email={user.email}
      name={user.name}
      totpEnabled={user.totpEnabled}
      recoveryLeft={user.recoveryCodes.length}
      mustChange={user.mustChangePassword}
      mustEnroll={env.require2fa && !user.totpEnabled}
    />
  );
}
