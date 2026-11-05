'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CollectionInfo } from '@/lib/content/labels';
import { formatDateTime } from '@/lib/format';
import { useAdmin } from './context';
import { Icon } from './Icon';

interface Row {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  updatedAt: number;
  publishedAt: number | null;
}

export function EntryList({ info, items }: { info: CollectionInfo; items: Row[] }) {
  const { api, run } = useAdmin();
  const [rows, setRows] = useState(items);

  async function move(index: number, delta: number) {
    const next = [...rows];
    const target = index + delta;
    const [row] = next.splice(index, 1);
    if (!row || target < 0 || target > next.length) return;
    next.splice(target, 0, row);
    setRows(next);
    await run(async () => {
      await api('/api/admin/entries', {
        method: 'PATCH',
        body: { collection: info.key, ids: next.map((r) => r.id) },
      });
    }, 'Ordre enregistré.');
  }

  return (
    <div className="page">
      <header className="page-head page-head-row">
        <div>
          <h1>{info.label}</h1>
          <p>
            {rows.length} {info.singular}
            {rows.length > 1 ? 's' : ''}
          </p>
        </div>
        <Link className="a-btn a-btn-primary" href={`/admin/contenu/${info.path}/nouveau`}>
          <Icon name="plus" size={16} />
          Ajouter
        </Link>
      </header>

      <section className="panel panel-flush">
        <table className="a-table a-table-rows">
          <thead>
            <tr>
              {info.sortable ? <th scope="col">Ordre</th> : null}
              <th scope="col">Titre</th>
              <th scope="col">État</th>
              <th scope="col">Modifié le</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}>
                {info.sortable ? (
                  <td className="order">
                    <button type="button" aria-label={`Monter ${row.title}`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <Icon name="up" size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Descendre ${row.title}`}
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <Icon name="down" size={16} />
                    </button>
                  </td>
                ) : null}
                <td>
                  <Link href={`/admin/contenu/${info.path}/${row.id}`} className="row-title">
                    {row.title}
                  </Link>
                  <small>
                    {info.base}/{row.slug}
                  </small>
                </td>
                <td>
                  <span className={`badge badge-${row.status}`}>{row.status === 'published' ? 'Publié' : 'Brouillon'}</span>
                </td>
                <td>{formatDateTime(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
