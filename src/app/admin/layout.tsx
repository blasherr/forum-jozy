import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminProvider } from '@/components/admin/context';
import { AdminShell } from '@/components/admin/Sidebar';
import { getAuth } from '@/lib/security/session';
import '@/styles/rich.css';
import '@/styles/admin.css';

export const metadata: Metadata = {
  title: 'Panel — New Frontier',
  robots: { index: false, follow: false, nocache: true },
};

/** Garde d'accès serveur : aucune page du panel n'est rendue sans session complète. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const auth = await getAuth();
  if (!auth) redirect('/connexion');
  return (
    <AdminProvider csrf={auth.csrf} role={auth.user.role} name={auth.user.name}>
      <AdminShell email={auth.user.email}>{children}</AdminShell>
    </AdminProvider>
  );
}
