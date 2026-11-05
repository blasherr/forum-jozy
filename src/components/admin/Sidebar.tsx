'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ROLE_LABELS } from '@/lib/content/labels';
import { useAdmin, type Role } from './context';
import { Icon, type IconName } from './Icon';

interface Item {
  href: string;
  label: string;
  icon: IconName;
  min?: Role;
}

const RANK: Record<Role, number> = { editor: 1, admin: 2, owner: 3 };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: '', items: [{ href: '/admin', label: 'Tableau de bord', icon: 'home' }] },
  {
    title: 'Contenu',
    items: [
      { href: '/admin/accueil', label: 'Page d’accueil', icon: 'layout' },
      { href: '/admin/contenu/reglement', label: 'Règlement', icon: 'scale' },
      { href: '/admin/contenu/guide', label: 'Guide', icon: 'book' },
      { href: '/admin/contenu/patch-notes', label: 'Patch-notes', icon: 'news' },
      { href: '/admin/contenu/histoire', label: 'Histoire', icon: 'scroll' },
      { href: '/admin/discord', label: 'Discords', icon: 'chat' },
      { href: '/admin/contenu/pages', label: 'Pages libres', icon: 'file' },
      { href: '/admin/textes', label: 'Titres des pages', icon: 'type' },
    ],
  },
  {
    title: 'Site',
    items: [
      { href: '/admin/apparence', label: 'Apparence', icon: 'palette', min: 'admin' },
      { href: '/admin/navigation', label: 'Menu du site', icon: 'menu', min: 'admin' },
      { href: '/admin/identite', label: 'Identité et adresses', icon: 'flag', min: 'admin' },
      { href: '/admin/medias', label: 'Médiathèque', icon: 'image' },
    ],
  },
  {
    title: 'Sécurité',
    items: [
      { href: '/admin/compte', label: 'Mon compte', icon: 'user' },
      { href: '/admin/utilisateurs', label: 'Comptes', icon: 'users', min: 'owner' },
      { href: '/admin/journal', label: 'Journal d’audit', icon: 'list', min: 'admin' },
      { href: '/admin/sauvegarde', label: 'Sauvegarde', icon: 'download', min: 'owner' },
    ],
  },
];

const SEGMENTS: Record<string, string> = {
  accueil: 'Page d’accueil',
  identite: 'Identité et adresses',
  apparence: 'Apparence',
  navigation: 'Menu du site',
  medias: 'Médiathèque',
  textes: 'Titres des pages',
  discord: 'Discords',
  compte: 'Mon compte',
  utilisateurs: 'Comptes',
  journal: 'Journal d’audit',
  sauvegarde: 'Sauvegarde',
  reglement: 'Règlement',
  guide: 'Guide',
  'patch-notes': 'Patch-notes',
  histoire: 'Histoire',
  pages: 'Pages libres',
  nouveau: 'Nouveau',
};

function crumbsOf(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).slice(1);
  const crumbs: { label: string; href: string }[] = [];
  let href = '/admin';
  for (const part of parts) {
    href += `/${part}`;
    if (part === 'contenu') continue;
    crumbs.push({ label: SEGMENTS[part] ?? 'Édition', href });
  }
  return crumbs;
}

function parentOf(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[1] === 'contenu' && parts.length > 3) return `/${parts.slice(0, 3).join('/')}`;
  return '/admin';
}

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { role, name, api, run } = useAdmin();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  async function logout() {
    await run(async () => {
      await api('/api/auth/logout', { method: 'POST' });
    });
    router.replace('/connexion');
    router.refresh();
  }

  const crumbs = crumbsOf(pathname);
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`admin ${open ? 'admin-menu-open' : ''}`}>
      <button type="button" className="side-scrim" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
      <aside className="side" aria-label="Panel d’administration">
        <Link href="/admin" className="side-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nf-mark.webp" alt="" width={36} height={27} />
          <span>
            <strong>New Frontier</strong>
            <small>Administration</small>
          </span>
        </Link>
        <nav>
          {GROUPS.map((group) => {
            const items = group.items.filter((i) => !i.min || RANK[role] >= RANK[i.min]);
            if (items.length === 0) return null;
            return (
              <div key={group.title || 'top'} className="side-group">
                {group.title ? <h2>{group.title}</h2> : null}
                <ul>
                  {items.map((item) => {
                    const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                    return (
                      <li key={item.href}>
                        <Link href={item.href} prefetch aria-current={active ? 'page' : undefined}>
                          <Icon name={item.icon} />
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
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="side-user">
            <strong>{name}</strong>
            <small title={email}>{ROLE_LABELS[role]}</small>
          </span>
          <button type="button" className="icon-btn" aria-label="Se déconnecter" title="Se déconnecter" onClick={logout}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <div className="admin-body">
        <header className="topline">
          <button type="button" className="icon-btn topline-menu" aria-label="Ouvrir le menu" onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          {pathname !== '/admin' ? (
            <Link href={parentOf(pathname)} className="icon-btn" aria-label="Retour" title="Retour">
              <Icon name="arrow-left" />
            </Link>
          ) : null}
          <ol className="breadcrumb">
            <li>
              <Link href="/admin">Panel</Link>
            </li>
            {crumbs.map((c, i) => (
              <li key={c.href}>
                {i === crumbs.length - 1 ? <span aria-current="page">{c.label}</span> : <Link href={c.href}>{c.label}</Link>}
              </li>
            ))}
          </ol>
          <a className="a-btn a-btn-ghost topline-site" href="/" target="_blank" rel="noopener">
            <Icon name="external" size={16} />
            Voir le site
          </a>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
