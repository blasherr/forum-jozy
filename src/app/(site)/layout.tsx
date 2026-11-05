import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BackBar } from '@/components/site/BackBar';
import { CopyButton } from '@/components/site/CopyButton';
import { DesignBar } from '@/components/site/DesignBar';
import { LiveUpdates } from '@/components/site/LiveUpdates';
import { Nav } from '@/components/site/Nav';
import { PageLoader } from '@/components/site/PageLoader';
import { Ornament, SmartLink } from '@/components/site/parts';
import { readDesignPreview } from '@/lib/content/design-preview';
import { getNav, getSetting } from '@/lib/content/queries';
import { themeCss } from '@/lib/content/theme';
import { safeHref } from '@/lib/richtext/url';
import '@/styles/site.css';
import '@/styles/rich.css';
import '@/styles/designs.css';
import '@/styles/designs-real.css';

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSetting('site');
  return {
    title: { default: `${site.name} — ${site.tagline}`, template: `%s — ${site.shortName}` },
    description: site.description,
    openGraph: {
      title: site.name,
      description: site.description,
      siteName: site.name,
      locale: 'fr_FR',
      type: 'website',
      images: [{ url: '/brand/og.jpg', width: 1200, height: 630, alt: site.name }],
    },
    twitter: { card: 'summary_large_image' },
    icons: { icon: '/brand/icon-96.png', apple: '/brand/nf-badge-512.png' },
  };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const [site, theme, nav, h, preview] = await Promise.all([
    getSetting('site'),
    getSetting('theme'),
    getNav(),
    headers(),
    readDesignPreview(),
  ]);
  const nonce = h.get('x-nonce') ?? undefined;
  const visible = nav
    .filter((n) => n.visible && safeHref(n.href))
    .map((n) => ({ id: n.id, label: n.label, href: n.href, newTab: n.newTab }));

  return (
    <div className="site" data-design={preview ?? theme.design}>
      <style nonce={nonce}>{themeCss(theme)}</style>
      {preview ? <DesignBar current={preview} /> : null}
      {/* Caractères de bois usés : ronge légèrement le contour des titres imprimés */}
      <svg className="svg-defs" aria-hidden="true" focusable="false">
        <filter id="nf-worn" x="-4%" y="-8%" width="108%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.06" numOctaves="3" seed="7" result="wave" />
          <feDisplacementMap in="SourceGraphic" in2="wave" scale="2.2" result="moved" />
          <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves="2" seed="3" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -9 7.1" result="holes" />
          <feComposite in="moved" in2="holes" operator="in" />
        </filter>
      </svg>

      <a className="skip" href="#contenu">
        Aller au contenu
      </a>

      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label={`${site.name}, accueil`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={site.logoMediaId ? `/media/${site.logoMediaId}` : '/brand/nf-mark.webp'}
              alt=""
              width={58}
              height={44}
            />
            <span>{site.shortName}</span>
          </Link>
          <Nav items={visible} />
        </div>
      </header>

      <BackBar labels={visible.map((n) => ({ href: n.href, label: n.label }))} />

      <main id="contenu">{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="footer-badge" src="/brand/nf-badge-256.webp" alt="" width={88} height={88} loading="lazy" />
            <div>
              <p className="footer-name">{site.shortName}</p>
              <p className="footer-motto">{site.footer.motto}</p>
            </div>
          </div>
          <div className="footer-col">
            <h2>Se rendre sur place</h2>
            <dl className="address">
              <div>
                <dt>{site.server.connectLabel}</dt>
                <dd>
                  <code>{site.server.connectCommand}</code>
                  <CopyButton text={site.server.connectCommand} />
                </dd>
              </div>
              <div>
                <dt>{site.server.teamspeakLabel}</dt>
                <dd>
                  <code>{site.server.teamspeakAddress}</code>
                  <CopyButton text={site.server.teamspeakAddress} />
                </dd>
              </div>
            </dl>
          </div>
          <div className="footer-col">
            <h2>Liens utiles</h2>
            <ul>
              {site.footer.links.map((link) => (
                <li key={link.href}>
                  <SmartLink href={link.href}>{link.label}</SmartLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <Ornament />
        <p className="footer-legal">{site.footer.legal}</p>
      </footer>

      <LiveUpdates />
      {site.loader.enabled ? (
        <PageLoader tips={site.loader.tips.filter((tip) => tip.trim())} images={site.loader.images} />
      ) : null}
    </div>
  );
}
