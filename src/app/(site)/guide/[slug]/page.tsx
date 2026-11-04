import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/site/Reader';
import { getPublished, getSetting, listSummaries } from '@/lib/content/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPublished('guide', slug);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

export default async function GuideEntryPage({ params }: Props) {
  const { slug } = await params;
  const [entry, guide, pages] = await Promise.all([
    getPublished('guide', slug),
    listSummaries('guide'),
    getSetting('pages'),
  ]);
  if (!entry) notFound();
  return <Reader title={pages.guide.title} base="/guide" entries={guide} entry={entry} />;
}
