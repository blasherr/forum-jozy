import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/RichText';
import { Ornament } from '@/components/site/parts';
import { getPublished, getSetting } from '@/lib/content/queries';
import { formatDate } from '@/lib/format';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPublished('patchnotes', slug);
  return entry ? { title: { absolute: entry.title }, description: entry.summary } : {};
}

export default async function PatchNotePage({ params }: Props) {
  const { slug } = await params;
  const [note, pages] = await Promise.all([getPublished('patchnotes', slug), getSetting('pages')]);
  if (!note) notFound();

  return (
    <div className="gazette-page">
      <section className="gazette paper">
        <header className="masthead masthead-small">
          <p className="masthead-name">
            <Link href="/patch-notes">{pages.patchnotes.title}</Link>
          </p>
          <Ornament />
        </header>
        <article className="dispatch">
          <header>
            <p className="dispatch-date">
              {formatDate(note.publishedAt ?? note.createdAt)}
              {note.meta.author ? ` — par ${note.meta.author}` : ''}
            </p>
            <h1>{note.title}</h1>
            {note.summary ? <p className="dispatch-lead">{note.summary}</p> : null}
          </header>
          <RichText doc={note.body} className="rich-columns rich-gazette" />
        </article>
      </section>
    </div>
  );
}
