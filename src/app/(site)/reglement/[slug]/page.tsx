import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Reader } from '@/components/site/Reader';
import { getPublished, getSetting, listSummaries } from '@/lib/content/queries';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPublished('rules', slug);
  return entry ? { title: `Règlement : ${entry.title}`, description: entry.summary } : {};
}

export default async function RulePage({ params }: Props) {
  const { slug } = await params;
  const [entry, rules, pages] = await Promise.all([
    getPublished('rules', slug),
    listSummaries('rules'),
    getSetting('pages'),
  ]);
  if (!entry) notFound();
  return <Reader title={pages.reglement.title} base="/reglement" entries={rules} entry={entry} />;
}
