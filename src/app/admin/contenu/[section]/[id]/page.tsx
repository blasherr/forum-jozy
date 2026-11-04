import { notFound } from 'next/navigation';
import { EntryEditor, type EntryDraft } from '@/components/admin/EntryEditor';
import { COLLECTION_INFO } from '@/lib/content/labels';
import { getEntryById, listAllSummaries } from '@/lib/content/queries';
import { EMPTY_DOC } from '@/lib/richtext/types';
import { requirePage } from '@/lib/security/page-guard';

export default async function ContentEdit({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { user } = await requirePage();
  const { section, id } = await params;
  const info = Object.hasOwn(COLLECTION_INFO, section) ? COLLECTION_INFO[section] : undefined;
  if (!info) notFound();

  let initial: EntryDraft;
  if (id === 'nouveau') {
    initial = {
      id: null,
      title: '',
      slug: '',
      summary: '',
      body: EMPTY_DOC,
      meta: info.key === 'patchnotes' ? { author: user.name } : {},
      status: 'draft',
      publishedAt: info.key === 'patchnotes' ? Date.now() : null,
    };
  } else {
    if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
    const entry = await getEntryById(id);
    if (!entry || entry.collection !== info.key) notFound();
    initial = {
      id: entry.id,
      title: entry.title,
      slug: entry.slug,
      summary: entry.summary,
      body: entry.body,
      meta: entry.meta,
      status: entry.status,
      publishedAt: entry.publishedAt,
    };
  }

  const categories =
    info.key === 'guide'
      ? [...new Set((await listAllSummaries('guide')).map((e) => e.meta.category).filter((c): c is string => Boolean(c)))]
      : [];

  return <EntryEditor key={initial.id ?? 'new'} info={info} initial={initial} categories={categories} />;
}
