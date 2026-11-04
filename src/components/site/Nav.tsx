'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { isExternal } from '@/lib/richtext/url';

export interface NavEntry {
  id: string;
  label: string;
  href: string;
  newTab: boolean;
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ items }: { items: NavEntry[] }) {
  const pathname = usePathname();
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (details.current) details.current.open = false;
  }, [pathname]);

  const links = items.map((item) => {
    const external = isExternal(item.href);
    const current = !external && isActive(pathname, item.href);
    const props = item.newTab || external ? { target: '_blank', rel: 'noopener noreferrer' } : {};
    return (
      <li key={item.id}>
        {external ? (
          <a href={item.href} {...props}>
            {item.label}
          </a>
        ) : (
          <Link href={item.href} prefetch aria-current={current ? 'page' : undefined} {...props}>
            {item.label}
          </Link>
        )}
      </li>
    );
  });

  return (
    <>
      <nav className="nav-desktop" aria-label="Navigation principale">
        <ul>{links}</ul>
      </nav>
      <details className="nav-mobile" ref={details}>
        <summary aria-label="Ouvrir le menu">
          <span className="nav-burger" aria-hidden="true" />
          <span>Menu</span>
        </summary>
        <nav aria-label="Navigation principale">
          <ul>{links}</ul>
        </nav>
      </details>
    </>
  );
}
