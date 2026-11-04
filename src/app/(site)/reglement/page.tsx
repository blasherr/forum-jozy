import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/site/parts';
import { getSetting, listPublished, listSummaries } from '@/lib/content/queries';
import { searchEntries } from '@/lib/content/search';
import { formatDate, plural, roman } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const { reglement } = await getSetting('pages');
  return { title: reglement.title, description: reglement.seoDescription };
}

export default async function RulesPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [pages, rules, params] = await Promise.all([getSetting('pages'), listSummaries('rules'), searchParams]);
  const q = typeof params.q === 'string' ? params.q.slice(0, 80) : '';
  const hits = q ? searchEntries(await listPublished('rules'), q) : [];

  return (
    <>
      <PageHeader {...pages.reglement} />
      <div className="wrap wrap-narrow">
        <form className="search" role="search" action="/reglement" method="get">
          <label htmlFor="q">Chercher une règle</label>
          <div className="search-row">
            <input id="q" name="q" type="search" defaultValue={q} maxLength={80} placeholder="Ex. : mort RP, otages, wanted…" />
            <button type="submit" className="btn btn-primary">
              Chercher
            </button>
          </div>
        </form>

        {q ? (
          <section className="sheet paper results" aria-live="polite">
            <h2>{plural(hits.length, 'résultat', 'résultats')} pour « {q} »</h2>
            {hits.length === 0 ? (
              <p>Rien trouvé. Essayez un mot plus court.</p>
            ) : (
              <ol>
                {hits.map((hit, i) => (
                  <li key={i}>
                    <Link href={`/reglement/${hit.entry.slug}${hit.anchor ? `#${hit.anchor}` : ''}`}>
                      <strong>
                        {hit.entry.title}
                        {hit.heading ? ` — ${hit.heading}` : ''}
                      </strong>
                    </Link>
                    <p>{hit.snippet}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ) : null}

        <ol className="chapters">
          {rules.map((rule, i) => (
            <li key={rule.id}>
              <Link href={`/reglement/${rule.slug}`} prefetch className="chapter paper paper-thin">
                <span className="chapter-num" aria-hidden="true">
                  {roman(i + 1)}
                </span>
                <span className="chapter-body">
                  <span className="chapter-title">{rule.title}</span>
                  <span className="chapter-text">{rule.summary}</span>
                </span>
                <span className="chapter-meta">{formatDate(rule.updatedAt)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
