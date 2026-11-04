'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ROLE_LABELS } from '@/lib/content/labels';
import { formatDateTime } from '@/lib/format';
import { useAdmin } from './context';
import { PageHead } from './forms';

interface Row {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'editor';
  disabled: boolean;
  totpEnabled: boolean;
  lastLoginAt: number | null;
}

export function UsersManager({ initial, selfId }: { initial: Row[]; selfId: string }) {
  const { api, run } = useAdmin();
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [adding, setAdding] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    const ok = await run(async () => {
      await api('/api/admin/users', {
        body: {
          email: String(f.get('email') ?? ''),
          name: String(f.get('name') ?? ''),
          role: String(f.get('role') ?? 'editor'),
          password: String(f.get('password') ?? ''),
        },
      });
    }, 'Compte créé. Il devra changer son mot de passe à la première connexion.');
    if (ok) {
      form.reset();
      setAdding(false);
      router.refresh();
    }
  }

  async function patch(row: Row, body: Partial<Pick<Row, 'role' | 'disabled'>>) {
    await run(async () => {
      await api(`/api/admin/users/${row.id}`, { method: 'PATCH', body });
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...body } : r)));
    }, 'Compte modifié.');
  }

  async function remove(row: Row) {
    if (!window.confirm(`Supprimer le compte ${row.email} ?`)) return;
    await run(async () => {
      await api(`/api/admin/users/${row.id}`, { method: 'DELETE' });
      setRows((list) => list.filter((r) => r.id !== row.id));
    }, 'Compte supprimé.');
  }

  return (
    <div className="page">
      <PageHead
        title="Comptes"
        text="Administrateur : tout le contenu et l’apparence. Rédacteur : les textes et les images."
      />
      <p>
        <button type="button" className="a-btn a-btn-primary" onClick={() => setAdding(!adding)}>
          {adding ? 'Annuler' : 'Créer un compte'}
        </button>
      </p>
      {adding ? (
        <form className="panel" onSubmit={create}>
          <label className="field">
            <span>E-mail</span>
            <input name="email" type="email" required maxLength={254} autoComplete="off" />
          </label>
          <label className="field">
            <span>Nom affiché</span>
            <input name="name" required maxLength={80} autoComplete="off" />
          </label>
          <label className="field">
            <span>Rôle</span>
            <select name="role" defaultValue="editor">
              <option value="editor">Rédacteur</option>
              <option value="admin">Administrateur</option>
            </select>
          </label>
          <label className="field">
            <span>Mot de passe provisoire</span>
            <input name="password" type="password" required minLength={12} maxLength={256} autoComplete="new-password" />
            <small>À transmettre par un canal sûr : il devra être changé à la première connexion.</small>
          </label>
          <button type="submit" className="a-btn a-btn-primary">
            Créer
          </button>
        </form>
      ) : null}
      <section className="panel panel-flush">
        <table className="a-table a-table-rows">
          <thead>
            <tr>
              <th scope="col">Compte</th>
              <th scope="col">Rôle</th>
              <th scope="col">2FA</th>
              <th scope="col">Dernière connexion</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const locked = row.role === 'owner' || row.id === selfId;
              return (
                <tr key={row.id}>
                  <td>
                    <span className="row-title">{row.name}</span>
                    <small>{row.email}</small>
                  </td>
                  <td>
                    {locked ? (
                      ROLE_LABELS[row.role]
                    ) : (
                      <select
                        aria-label={`Rôle de ${row.name}`}
                        value={row.role}
                        onChange={(e) => patch(row, { role: e.target.value as 'admin' | 'editor' })}
                      >
                        <option value="editor">Rédacteur</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    )}
                  </td>
                  <td>{row.totpEnabled ? 'Activée' : 'Non'}</td>
                  <td>{formatDateTime(row.lastLoginAt) || 'Jamais'}</td>
                  <td>
                    {locked ? null : (
                      <div className="row-actions">
                        <button type="button" className="a-link" onClick={() => patch(row, { disabled: !row.disabled })}>
                          {row.disabled ? 'Réactiver' : 'Suspendre'}
                        </button>
                        <button type="button" className="a-link" onClick={() => remove(row)}>
                          Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
