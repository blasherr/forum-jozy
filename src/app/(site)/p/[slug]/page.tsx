import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/RichText';
import { getPublished } from '@/lib/content/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPublished('pages', slug);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params;
  const entry = await getPublished('pages', slug);
  if (!entry) notFound();
  return (
    <div className="wrap wrap-narrow page-top">
      <article className="folio paper">
        <header className="folio-head">
          <h1>{entry.title}</h1>
        </header>
        <RichText doc={entry.body} />
      </article>
    </div>
  );
}
