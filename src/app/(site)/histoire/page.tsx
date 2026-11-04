import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/site/parts';
import { getSetting, listSummaries } from '@/lib/content/queries';
import { roman } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const { histoire } = await getSetting('pages');
  return { title: histoire.title, description: histoire.seoDescription };
}

export default async function HistoryPage() {
  const [pages, lore] = await Promise.all([getSetting('pages'), listSummaries('lore')]);
  return (
    <>
      <PageHeader {...pages.histoire} />
      <div className="wrap wrap-narrow">
        <ol className="chapters">
          {lore.map((entry, i) => (
            <li key={entry.id}>
              <Link href={`/histoire/${entry.slug}`} prefetch className="chapter paper paper-thin">
                <span className="chapter-num" aria-hidden="true">
                  {roman(i + 1)}
                </span>
                <span className="chapter-body">
                  <span className="chapter-title">{entry.title}</span>
                  <span className="chapter-text">{entry.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
