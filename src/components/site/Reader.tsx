import Link from 'next/link';
import type { ReactNode } from 'react';
import { RichText } from '@/components/RichText';
import type { EntrySummary, PublicEntry } from '@/lib/content/queries';
import { formatDate, roman } from '@/lib/format';
import { extractHeadings } from '@/lib/richtext/headings';

export function Reader({
  title,
  base,
  entries,
  entry,
  byline,
}: {
  title: string;
  base: string;
  entries: EntrySummary[];
  entry: PublicEntry;
  byline?: ReactNode;
}) {
  const headings = extractHeadings(entry.body);
  const index = entries.findIndex((e) => e.id === entry.id);
  const prev = index > 0 ? entries[index - 1] : undefined;
  const next = index >= 0 && index < entries.length - 1 ? entries[index + 1] : undefined;

  return (
    <div className="reader">
      <aside className="reader-side" aria-label={`Sommaire : ${title}`}>
        <div className="spine">
          <p className="spine-title">{title}</p>
          <ol className="spine-list">
            {entries.map((e, i) => (
              <li key={e.id}>
                <Link href={`${base}/${e.slug}`} prefetch aria-current={e.id === entry.id ? 'page' : undefined}>
                  <span aria-hidden="true">{roman(i + 1)}</span>
                  {e.title}
                </Link>
              </li>
            ))}
          </ol>
        </div>
        {headings.length > 0 ? (
          <details className="toc paper paper-thin" open>
            <summary>Dans ce chapitre</summary>
            <ol>
              {headings.map((h) => (
                <li key={h.id} className={`toc-level-${h.level}`}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ol>
          </details>
        ) : null}
      </aside>

      <article className="folio paper">
        <header className="folio-head">
          <h1>{entry.title}</h1>
          {byline ? <p className="folio-byline">{byline}</p> : null}
        </header>
        <RichText doc={entry.body} />
        <p className="folio-updated">Dernière mise à jour : {formatDate(entry.updatedAt)}</p>
        <nav className="folio-nav" aria-label="Chapitres voisins">
          {prev ? (
            <Link href={`${base}/${prev.slug}`} rel="prev">
              <span>Précédent</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`${base}/${next.slug}`} rel="next" className="folio-next">
              <span>Suivant</span>
              {next.title}
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}
