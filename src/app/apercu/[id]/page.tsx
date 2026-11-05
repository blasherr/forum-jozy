import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RichText } from '@/components/RichText';
import { getEntryById, getSetting } from '@/lib/content/queries';
import { themeCss } from '@/lib/content/theme';
import { requirePage } from '@/lib/security/page-guard';
import { headers } from 'next/headers';
import '@/styles/site.css';
import '@/styles/rich.css';
import '@/styles/designs.css';
import '@/styles/designs-real.css';

export const metadata: Metadata = { title: 'Aperçu', robots: { index: false, follow: false } };

/** Aperçu d'un brouillon : réservé aux comptes connectés. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [entry, theme, h] = await Promise.all([getEntryById(id), getSetting('theme'), headers()]);
  if (!entry) notFound();
  return (
    <div className="site" data-design={theme.design}>
      <style nonce={h.get('x-nonce') ?? undefined}>{themeCss(theme)}</style>
      <div className="preview-banner">Aperçu : cette page n’est pas forcément publiée.</div>
      <div className="wrap wrap-narrow page-top">
        <article className="folio paper">
          <header className="folio-head">
            <h1>{entry.title}</h1>
          </header>
          <RichText doc={entry.body} />
        </article>
      </div>
    </div>
  );
}
