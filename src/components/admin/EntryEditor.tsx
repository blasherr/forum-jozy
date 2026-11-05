'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CollectionInfo } from '@/lib/content/labels';
import type { RichDoc } from '@/lib/richtext/types';
import { slugify } from '@/lib/richtext/validate';
import { useAdmin } from './context';
import { Icon } from './Icon';

const WordEditor = dynamic(() => import('./WordEditor').then((m) => m.WordEditor), {
  ssr: false,
  loading: () => <div className="word word-loading">Ouverture du document…</div>,
});

export interface EntryDraft {
  id: string | null;
  title: string;
  slug: string;
  summary: string;
  body: RichDoc;
  meta: { category?: string; author?: string; version?: string };
  status: 'draft' | 'published';
  publishedAt: number | null;
}

interface Revision {
  id: string;
  createdAt: number;
  note: string | null;
  author: string | null;
}

const toInput = (ms: number | null) => {
  if (!ms) return '';
  const offset = new Date(ms).getTimezoneOffset() * 60000;
  return new Date(ms - offset).toISOString().slice(0, 16);
};

export function EntryEditor({
  info,
  initial,
  categories,
}: {
  info: CollectionInfo;
  initial: EntryDraft;
  categories: string[];
}) {
  const { api, run, role } = useAdmin();
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Revision[] | null>(null);
  const ref = useRef(draft);
  ref.current = draft;

  const update = useCallback((patch: Partial<EntryDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  }, []);

  const onBody = useCallback((body: RichDoc) => update({ body }), [update]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return undefined;
    const guard = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.('a[href]');
      if (!link || link.getAttribute('target') === '_blank') return;
      if (!window.confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener('click', guard, true);
    return () => document.removeEventListener('click', guard, true);
  }, [dirty]);

  const save = useCallback(
    async (status: 'draft' | 'published') => {
      setSaving(true);
      const d = ref.current;
      const entry = {
        title: d.title,
        slug: d.slug,
        summary: d.summary,
        body: d.body,
        meta: d.meta,
        status,
        publishedAt: d.publishedAt,
      };
      const ok = await run(
        async () => {
          if (d.id) {
            await api(`/api/admin/entries/${d.id}`, { method: 'PUT', body: entry });
            setDraft((x) => ({ ...x, status }));
          } else {
            const res = await api<{ id: string }>('/api/admin/entries', {
              body: { collection: info.key, entry },
            });
            setDirty(false);
            router.replace(`/admin/contenu/${info.path}/${res.id}`);
          }
        },
        status === 'published' ? 'Publié sur le site.' : 'Brouillon enregistré.',
      );
      if (ok) {
        setDirty(false);
        setHistory(null);
      }
      setSaving(false);
    },
    [api, info, router, run],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save(ref.current.status);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  async function loadHistory() {
    if (!draft.id) return;
    await run(async () => {
      const data = await api<{ history: Revision[] }>(`/api/admin/entries/${draft.id}`);
      setHistory(data.history);
    });
  }

  async function restore(revisionId: string) {
    if (!draft.id || !window.confirm('Remplacer le contenu actuel par cette version ?')) return;
    const ok = await run(async () => {
      await api(`/api/admin/entries/${draft.id}/restore`, { body: { revisionId } });
    }, 'Version restaurée.');
    if (ok) window.location.reload();
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Supprimer définitivement « ${draft.title} » ?`)) return;
    const ok = await run(async () => {
      await api(`/api/admin/entries/${draft.id}`, { method: 'DELETE' });
    }, 'Supprimé.');
    if (ok) {
      setDirty(false);
      router.replace(`/admin/contenu/${info.path}`);
      router.refresh();
    }
  }

  return (
    <div className="doc-layout">
      <div className="doc-main">
        <div className="doc-titlebar">
          <input
            className="doc-title"
            aria-label="Titre"
            value={draft.title}
            maxLength={160}
            placeholder={`Titre du ${info.singular}`}
            onChange={(e) => {
              const title = e.target.value;
              update(slugTouched ? { title } : { title, slug: slugify(title) });
            }}
          />
          <span className={`doc-state ${dirty ? 'doc-state-dirty' : ''}`}>
            {saving ? 'Enregistrement…' : dirty ? 'Modifications non enregistrées' : 'Enregistré'}
          </span>
        </div>
        <WordEditor value={initial.body} onChange={onBody} />
      </div>

      <aside className="doc-side" aria-label="Propriétés">
        <section className="panel">
          <h2>Publication</h2>
          <p className={`badge badge-${draft.status}`}>{draft.status === 'published' ? 'Publié' : 'Brouillon'}</p>
          <div className="stack">
            <button type="button" className="a-btn a-btn-primary" disabled={saving} onClick={() => save('published')}>
              {draft.status === 'published' ? 'Mettre à jour' : 'Publier'}
            </button>
            <button type="button" className="a-btn" disabled={saving} onClick={() => save('draft')}>
              {draft.status === 'published' ? 'Repasser en brouillon' : 'Enregistrer le brouillon'}
            </button>
            {draft.id ? (
              <>
                <a className="a-btn" href={`/apercu/${draft.id}`} target="_blank" rel="noopener">
                  <Icon name="eye" size={16} />
                  Aperçu
                </a>
                {draft.status === 'published' ? (
                  <Link className="a-btn" href={`${info.base}/${draft.slug}`} target="_blank">
                    Voir sur le site
                  </Link>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="hint">Ctrl + S enregistre sans changer le statut.</p>
        </section>

        <section className="panel">
          <h2>Propriétés</h2>
          <label className="field">
            <span>Adresse de la page</span>
            <input
              value={draft.slug}
              maxLength={80}
              spellCheck={false}
              onChange={(e) => {
                setSlugTouched(true);
                update({ slug: e.target.value.toLowerCase() });
              }}
            />
            <small>
              {info.base}/{draft.slug || '…'}
            </small>
          </label>
          <label className="field">
            <span>Résumé</span>
            <textarea rows={3} maxLength={500} value={draft.summary} onChange={(e) => update({ summary: e.target.value })} />
          </label>
          {info.key === 'guide' ? (
            <label className="field">
              <span>Catégorie</span>
              <input
                list="guide-categories"
                maxLength={80}
                value={draft.meta.category ?? ''}
                onChange={(e) => update({ meta: { ...draft.meta, category: e.target.value } })}
              />
              <datalist id="guide-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          ) : null}
          {info.key === 'patchnotes' ? (
            <>
              <label className="field">
                <span>Auteur</span>
                <input
                  maxLength={80}
                  value={draft.meta.author ?? ''}
                  onChange={(e) => update({ meta: { ...draft.meta, author: e.target.value } })}
                />
              </label>
              <label className="field">
                <span>Date de publication</span>
                <input
                  type="datetime-local"
                  value={toInput(draft.publishedAt)}
                  onChange={(e) => update({ publishedAt: e.target.value ? new Date(e.target.value).getTime() : null })}
                />
              </label>
            </>
          ) : null}
        </section>

        {draft.id ? (
          <section className="panel">
            <h2>Historique</h2>
            {history === null ? (
              <button type="button" className="a-btn" onClick={loadHistory}>
                Afficher les versions
              </button>
            ) : history.length === 0 ? (
              <p className="hint">Aucune version précédente.</p>
            ) : (
              <ul className="history">
                {history.map((rev) => (
                  <li key={rev.id}>
                    <span>
                      {new Date(rev.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      {rev.author ? ` · ${rev.author}` : ''}
                    </span>
                    <button type="button" className="a-link" onClick={() => restore(rev.id)}>
                      Restaurer
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {draft.id && role !== 'editor' ? (
          <section className="panel">
            <button type="button" className="a-btn a-btn-danger" onClick={remove}>
              <Icon name="trash" size={16} />
              Supprimer
            </button>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
