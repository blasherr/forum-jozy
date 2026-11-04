import Link from 'next/link';
import type { ReactNode } from 'react';
import { isExternal, safeHref } from '@/lib/richtext/url';

/** Lien sûr : refuse tout ce qui n'est pas autorisé et isole les ouvertures externes. */
export function SmartLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const safe = safeHref(href);
  if (!safe) return <span className={className}>{children}</span>;
  if (isExternal(safe)) {
    return (
      <a href={safe} className={className} target="_blank" rel="noopener noreferrer nofollow">
        {children}
      </a>
    );
  }
  return (
    <Link href={safe} className={className}>
      {children}
    </Link>
  );
}

export function Ornament({ className = '' }: { className?: string }) {
  return (
    <svg className={`ornament ${className}`} viewBox="0 0 320 24" aria-hidden="true" focusable="false">
      <path d="M0 12h118M202 12h118" stroke="currentColor" strokeWidth="1" />
      <path d="M0 15h96M224 15h96" stroke="currentColor" strokeWidth=".5" />
      <path
        d="M160 2l3.4 6.6L170 12l-6.6 3.4L160 22l-3.4-6.6L150 12l6.6-3.4z"
        fill="currentColor"
      />
      <path
        d="M122 12c6-7 14-7 18 0-4 7-12 7-18 0zm76 0c-6-7-14-7-18 0 4 7 12 7 18 0z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="131" cy="12" r="1.6" fill="currentColor" />
      <circle cx="189" cy="12" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function SectionTitle({
  kicker,
  title,
  tone = 'ink',
}: {
  kicker?: string;
  title: string;
  tone?: 'ink' | 'light';
}) {
  return (
    <header className={`section-title section-title-${tone}`}>
      {kicker ? <p className="kicker">{kicker}</p> : null}
      <h2>{title}</h2>
      <Ornament />
    </header>
  );
}

export function PageHeader({
  kicker,
  title,
  subtitle,
  image,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  image?: string | null;
}) {
  return (
    <header className="page-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image ? <img className="page-header-img" src={`/media/${image}`} alt="" /> : null}
      <div className="page-header-inner">
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        <Ornament />
        {subtitle ? <p className="page-header-sub">{subtitle}</p> : null}
      </div>
    </header>
  );
}

export function Seal({ color, className = '', size = 96 }: { color: string; className?: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/textures/seal-${color}.webp`}
      alt=""
      width={size}
      height={size}
      className={`seal ${className}`}
      loading="lazy"
      decoding="async"
    />
  );
}
