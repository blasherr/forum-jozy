import { asc } from 'drizzle-orm';
import { UsersManager } from '@/components/admin/UsersManager';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminUsers() {
  const { user } = await requirePage('owner');
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
      totpEnabled: users.totpEnabled,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));
  return <UsersManager initial={rows} selfId={user.id} />;
}
