import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/site/Reader';
import { getPublished, getSetting, listSummaries } from '@/lib/content/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPublished('lore', slug);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

export default async function LorePage({ params }: Props) {
  const { slug } = await params;
  const [entry, lore, pages] = await Promise.all([
    getPublished('lore', slug),
    listSummaries('lore'),
    getSetting('pages'),
  ]);
  if (!entry) notFound();
  return <Reader title={pages.histoire.title} base="/histoire" entries={lore} entry={entry} />;
}
