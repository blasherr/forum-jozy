'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

function parentOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  // /admin/contenu/guide/<id> revient à la liste, tout le reste au tableau de bord.
  if (parts[1] === 'contenu' && parts.length > 3) return `/${parts.slice(0, 3).join('/')}`;
  return '/admin';
}

export function AdminBack() {
  const pathname = usePathname();
  if (pathname === '/admin') return null;
  const parent = parentOf(pathname);
  return (
    <div className="admin-back">
      <Link href={parent} className="a-btn">
        <span aria-hidden="true">←</span> {parent === '/admin' ? 'Tableau de bord' : 'Retour à la liste'}
      </Link>
    </div>
  );
}
