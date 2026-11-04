import type { Metadata } from 'next';
import Link from 'next/link';
import { RichText } from '@/components/RichText';
import { Ornament } from '@/components/site/parts';
import { getPublished, getSetting, listSummaries } from '@/lib/content/queries';
import { formatDate } from '@/lib/format';

export async function generateMetadata(): Promise<Metadata> {
  const { patchnotes } = await getSetting('pages');
  return { title: patchnotes.title, description: patchnotes.seoDescription };
}

export default async function PatchNotesPage() {
  const [pages, site, notes] = await Promise.all([
    getSetting('pages'),
    getSetting('site'),
    listSummaries('patchnotes'),
  ]);
  const [first, ...older] = notes;
  const latest = first ? await getPublished('patchnotes', first.slug) : null;
  const header = pages.patchnotes;

  return (
    <div className="gazette-page">
      <section className="gazette paper">
        <header className="masthead">
          <p className="masthead-top">
            <span>{header.kicker}</span>
            <span>{site.shortName}</span>
            <span>{notes.length > 1 ? `${notes.length} numéros parus` : 'Premier numéro'}</span>
          </p>
          <h1>{header.title}</h1>
          <p className="masthead-sub">{header.subtitle}</p>
          <Ornament />
        </header>

        {latest ? (
          <article className="dispatch">
            <header>
              <p className="dispatch-date">
                {formatDate(latest.publishedAt ?? latest.createdAt)}
                {latest.meta.author ? ` — par ${latest.meta.author}` : ''}
              </p>
              <h2>
                <Link href={`/patch-notes/${latest.slug}`}>{latest.title}</Link>
              </h2>
              {latest.summary ? <p className="dispatch-lead">{latest.summary}</p> : null}
            </header>
            <RichText doc={latest.body} className="rich-columns rich-gazette" />
          </article>
        ) : (
          <p className="center">Aucune dépêche pour l’instant.</p>
        )}

        {older.length > 0 ? (
          <section className="archives">
            <h2>Numéros précédents</h2>
            <ul>
              {older.map((note) => (
                <li key={note.id}>
                  <time dateTime={new Date(note.publishedAt ?? note.createdAt).toISOString()}>
                    {formatDate(note.publishedAt ?? note.createdAt)}
                  </time>
                  <Link href={`/patch-notes/${note.slug}`}>{note.title}</Link>
                  <p>{note.summary}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </div>
  );
}
