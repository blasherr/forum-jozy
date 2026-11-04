import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/site/parts';
import { getSetting, listSummaries, type EntrySummary } from '@/lib/content/queries';

export async function generateMetadata(): Promise<Metadata> {
  const { guide } = await getSetting('pages');
  return { title: guide.title, description: guide.seoDescription };
}

export default async function GuidePage() {
  const [pages, guide] = await Promise.all([getSetting('pages'), listSummaries('guide')]);
  const groups = new Map<string, EntrySummary[]>();
  for (const entry of guide) {
    const key = entry.meta.category ?? 'Divers';
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  return (
    <>
      <PageHeader {...pages.guide} />
      <div className="wrap wrap-narrow">
        {[...groups.entries()].map(([category, items]) => (
          <section key={category} className="topic-group">
            <h2>{category}</h2>
            <ul className="topics">
              {items.map((entry) => (
                <li key={entry.id}>
                  <Link href={`/guide/${entry.slug}`} prefetch className="topic paper paper-thin">
                    <span className="topic-title">{entry.title}</span>
                    <span className="topic-text">{entry.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
