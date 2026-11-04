import { NavForm } from '@/components/admin/settings-forms';
import { getNav } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminNav() {
  await requirePage('admin');
  const nav = await getNav();
  return (
    <NavForm
      initial={nav.map((n) => ({
        id: /^[0-9a-f-]{36}$/.test(n.id) ? n.id : undefined,
        label: n.label,
        href: n.href,
        visible: n.visible,
        newTab: n.newTab,
      }))}
    />
  );
}
