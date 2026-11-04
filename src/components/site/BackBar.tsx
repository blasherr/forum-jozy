'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type MouseEvent } from 'react';

/** Pages vues pendant cette visite : « Retour » revient à la page d'où l'on vient vraiment. */
const trail: string[] = [];

function parentOf(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 1 || parts[0] === 'p') return '/';
  return `/${parts.slice(0, -1).join('/')}`;
}

export function BackBar({ labels }: { labels: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (trail[trail.length - 1] === pathname) return;
    if (trail[trail.length - 2] === pathname) trail.pop();
    else trail.push(pathname);
  }, [pathname]);

  if (pathname === '/') return null;

  const parent = parentOf(pathname);
  const section = `/${pathname.split('/').filter(Boolean)[0] ?? ''}`;
  const sectionLabel = labels.find((l) => l.href === section)?.label;
  const parentLabel = parent === '/' ? 'l’accueil' : (labels.find((l) => l.href === parent)?.label ?? 'la page précédente');

  function goBack(event: MouseEvent<HTMLAnchorElement>) {
    if (trail.length > 1) {
      event.preventDefault();
      router.back();
    }
  }

  return (
    <nav className="backbar" aria-label="Retour et fil d’Ariane">
      <div className="backbar-inner">
        <Link href={parent} className="back" onClick={goBack} aria-label={`Retour vers ${parentLabel}`}>
          <span className="back-arrow" aria-hidden="true" />
          Retour
        </Link>
        <ol className="crumbs">
          <li>
            <Link href="/">Accueil</Link>
          </li>
          {sectionLabel ? (
            <li>
              {parent === '/' ? <span aria-current="page">{sectionLabel}</span> : <Link href={section}>{sectionLabel}</Link>}
            </li>
          ) : null}
        </ol>
      </div>
    </nav>
  );
}
