'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAdmin, type Role } from './context';

interface Item {
  href: string;
  label: string;
  min?: Role;
}

const RANK: Record<Role, number> = { editor: 1, admin: 2, owner: 3 };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Vue d’ensemble', items: [{ href: '/admin', label: 'Tableau de bord' }] },
  {
    title: 'Pages du site',
    items: [
      { href: '/admin/accueil', label: 'Page d’accueil' },
      { href: '/admin/contenu/reglement', label: 'Règlement' },
      { href: '/admin/contenu/guide', label: 'Guide' },
      { href: '/admin/contenu/patch-notes', label: 'Patch-notes' },
      { href: '/admin/contenu/histoire', label: 'Histoire' },
      { href: '/admin/discord', label: 'Discords' },
      { href: '/admin/contenu/pages', label: 'Pages libres' },
      { href: '/admin/textes', label: 'Titres des pages' },
    ],
  },
  {
    title: 'Structure',
    items: [
      { href: '/admin/navigation', label: 'Menu du site', min: 'admin' },
      { href: '/admin/identite', label: 'Identité et adresses', min: 'admin' },
      { href: '/admin/apparence', label: 'Apparence', min: 'admin' },
      { href: '/admin/medias', label: 'Médiathèque' },
    ],
  },
  {
    title: 'Sécurité',
    items: [
      { href: '/admin/compte', label: 'Mon compte' },
      { href: '/admin/utilisateurs', label: 'Comptes', min: 'owner' },
      { href: '/admin/journal', label: 'Journal d’audit', min: 'admin' },
      { href: '/admin/sauvegarde', label: 'Sauvegarde', min: 'owner' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { role, name, api, run } = useAdmin();

  async function logout() {
    await run(async () => {
      await api('/api/auth/logout', { method: 'POST' });
    });
    router.replace('/connexion');
    router.refresh();
  }

  return (
    <aside className="side">
      <Link href="/admin" className="side-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/nf-mark.webp" alt="" width={46} height={35} />
        <span>Panel</span>
      </Link>
      <nav aria-label="Panel d’administration">
        {GROUPS.map((group) => {
          const items = group.items.filter((i) => !i.min || RANK[role] >= RANK[i.min]);
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="side-group">
              <h2>{group.title}</h2>
              <ul>
                {items.map((item) => {
                  const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link href={item.href} aria-current={active ? 'page' : undefined}>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="side-foot">
        <p>{name}</p>
        <div>
          <a href="/" target="_blank" rel="noopener">
            Voir le site
          </a>
          <button type="button" onClick={logout}>
            Se déconnecter
          </button>
        </div>
      </div>
    </aside>
  );
}
