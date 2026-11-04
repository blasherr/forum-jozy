import { notFound } from 'next/navigation';
import { EntryList } from '@/components/admin/EntryList';
import { COLLECTION_INFO } from '@/lib/content/labels';
import { listAllSummaries } from '@/lib/content/queries';
import { requirePage } from '@/lib/security/page-guard';

export default async function ContentList({ params }: { params: Promise<{ section: string }> }) {
  await requirePage();
  const { section } = await params;
  const info = Object.hasOwn(COLLECTION_INFO, section) ? COLLECTION_INFO[section] : undefined;
  if (!info) notFound();
  const entries = await listAllSummaries(info.key);
  return (
    <EntryList
      info={info}
      items={entries.map((e) => ({
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        updatedAt: e.updatedAt,
        publishedAt: e.publishedAt,
      }))}
    />
  );
}
