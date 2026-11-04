'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatDateTime } from '@/lib/format';
import { useAdmin } from './context';
import { PageHead } from './forms';

interface SessionRow {
  idHash: string;
  createdAt: number;
  lastSeenAt: number;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

function QrCode({ size, cells }: { size: number; cells: number[] }) {
  const d = cells
    .map((on, i) => (on ? `M${i % size} ${Math.floor(i / size)}h1v1h-1z` : ''))
    .join('');
  return (
    <svg className="qr" viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label="QR code d’activation">
      <rect x="-2" y="-2" width={size + 4} height={size + 4} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="recovery">
      <h3>Vos codes de secours</h3>
      <p>
        Notez-les maintenant, ils ne seront plus jamais affichés. Chacun remplace une fois votre application si vous perdez
        votre téléphone.
      </p>
      <ul>
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      <button type="button" className="a-btn a-btn-primary" onClick={onDone}>
        Je les ai notés
      </button>
    </div>
  );
}

function shortAgent(ua: string | null) {
  if (!ua) return 'Navigateur inconnu';
  const browser = /Firefox\//.test(ua) ? 'Firefox' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ` sur ${os}` : ''}`;
}

export function AccountSettings({
  email,
  name,
  totpEnabled,
  recoveryLeft,
  mustChange,
  mustEnroll,
}: {
  email: string;
  name: string;
  totpEnabled: boolean;
  recoveryLeft: number;
  mustChange: boolean;
  mustEnroll: boolean;
}) {
  const { api, run } = useAdmin();
  const router = useRouter();
  const [enrolment, setEnrolment] = useState<{ secret: string; qr: { size: number; cells: number[] } } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  const loadSessions = useCallback(async () => {
    await run(async () => {
      const data = await api<{ sessions: SessionRow[] }>('/api/admin/account');
      setSessions(data.sessions);
    });
  }, [api, run]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (f.get('next') !== f.get('confirm')) {
      await run(async () => {
        throw new Error('Les deux mots de passe ne correspondent pas.');
      });
      return;
    }
    const ok = await run(async () => {
      await api('/api/admin/account', {
        body: { action: 'password', current: String(f.get('current') ?? ''), next: String(f.get('next') ?? '') },
      });
    }, 'Mot de passe changé. Vos autres sessions ont été fermées.');
    // La session a changé de jeton, donc le jeton CSRF aussi : la page doit repartir de zéro.
    if (ok) window.location.reload();
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('name') ?? '');
    const ok = await run(async () => {
      await api('/api/admin/account', { body: { action: 'profile', name: value } });
    }, 'Nom enregistré.');
    if (ok) router.refresh();
  }

  async function startTotp() {
    await run(async () => {
      setEnrolment(await api('/api/admin/account/totp', { body: { action: 'start' } }));
    });
  }

  async function confirmTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    await run(async () => {
      const res = await api<{ recoveryCodes: string[] }>('/api/admin/account/totp', { body: { action: 'confirm', code } });
      setEnrolment(null);
      setCodes(res.recoveryCodes);
    }, 'Double authentification activée.');
  }

  async function disableTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const ok = await run(async () => {
      await api('/api/admin/account/totp', {
        body: { action: 'disable', password: String(f.get('password') ?? ''), code: String(f.get('code') ?? '') },
      });
    }, 'Double authentification désactivée.');
    if (ok) router.refresh();
  }

  async function regenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get('code') ?? '');
    await run(async () => {
      const res = await api<{ recoveryCodes: string[] }>('/api/admin/account/totp', { body: { action: 'recovery', code } });
      setCodes(res.recoveryCodes);
    });
  }

  async function revoke(hash: string) {
    await run(async () => {
      await api('/api/admin/account', { body: { action: 'revoke', sessionHash: hash } });
    }, 'Session fermée.');
    void loadSessions();
  }

  async function revokeOthers() {
    await run(async () => {
      await api('/api/admin/account', { body: { action: 'revoke-others' } });
    }, 'Autres sessions fermées.');
    void loadSessions();
  }

  return (
    <div className="page">
      <PageHead title="Mon compte" text={email} />

      {mustChange ? <p className="alert">Changez votre mot de passe provisoire pour accéder au panel.</p> : null}
      {mustEnroll && !mustChange ? <p className="alert">Activez la double authentification pour accéder au panel.</p> : null}

      <div className="grid-2">
        <section className="panel">
          <h2>Mot de passe</h2>
          <form onSubmit={changePassword}>
            <label className="field">
              <span>Mot de passe actuel</span>
              <input name="current" type="password" required maxLength={256} autoComplete="current-password" />
            </label>
            <label className="field">
              <span>Nouveau mot de passe</span>
              <input name="next" type="password" required minLength={12} maxLength={256} autoComplete="new-password" />
              <small>12 caractères minimum. Une phrase longue est idéale.</small>
            </label>
            <label className="field">
              <span>Confirmer</span>
              <input name="confirm" type="password" required minLength={12} maxLength={256} autoComplete="new-password" />
            </label>
            <button type="submit" className="a-btn a-btn-primary">
              Changer le mot de passe
            </button>
          </form>
        </section>

        <section className="panel">
          <h2>Double authentification</h2>
          {codes ? (
            <RecoveryCodes
              codes={codes}
              onDone={() => {
                setCodes(null);
                router.refresh();
              }}
            />
          ) : totpEnabled ? (
            <>
              <p className="badge badge-published">Activée</p>
              <p className="hint">{recoveryLeft} code(s) de secours restant(s).</p>
              <details className="sub">
                <summary>Renouveler les codes de secours</summary>
                <form onSubmit={regenerate}>
                  <label className="field">
                    <span>Code actuel de votre application</span>
                    <input name="code" required maxLength={20} autoComplete="one-time-code" />
                  </label>
                  <button type="submit" className="a-btn">
                    Renouveler
                  </button>
                </form>
              </details>
              <details className="sub">
                <summary>Désactiver</summary>
                <form onSubmit={disableTotp}>
                  <label className="field">
                    <span>Mot de passe</span>
                    <input name="password" type="password" required maxLength={256} autoComplete="current-password" />
                  </label>
                  <label className="field">
                    <span>Code actuel</span>
                    <input name="code" required maxLength={20} autoComplete="one-time-code" />
                  </label>
                  <button type="submit" className="a-btn a-btn-danger">
                    Désactiver
                  </button>
                </form>
              </details>
            </>
          ) : enrolment ? (
            <>
              <p>Scannez ce code avec Google Authenticator, Aegis, 1Password ou une application équivalente.</p>
              <QrCode size={enrolment.qr.size} cells={enrolment.qr.cells} />
              <p className="hint">
                Saisie manuelle : <code className="secret">{enrolment.secret}</code>
              </p>
              <form onSubmit={confirmTotp}>
                <label className="field">
                  <span>Code à 6 chiffres</span>
                  <input name="code" required inputMode="numeric" maxLength={6} pattern="[0-9]{6}" autoComplete="one-time-code" autoFocus />
                </label>
                <button type="submit" className="a-btn a-btn-primary">
                  Activer
                </button>
              </form>
            </>
          ) : (
            <>
              <p>Un code temporaire sur votre téléphone, en plus du mot de passe : même un mot de passe volé ne suffit plus.</p>
              <button type="button" className="a-btn a-btn-primary" onClick={startTotp}>
                Activer
              </button>
            </>
          )}
        </section>
      </div>

      <section className="panel">
        <h2>Profil</h2>
        <form onSubmit={saveName}>
          <label className="field">
            <span>Nom affiché</span>
            <input name="name" defaultValue={name} required maxLength={80} />
          </label>
          <button type="submit" className="a-btn">
            Enregistrer
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Sessions actives</h2>
          <button type="button" className="a-btn" onClick={revokeOthers}>
            Fermer les autres sessions
          </button>
        </div>
        <table className="a-table">
          <tbody>
            {sessions.map((s) => (
              <tr key={s.idHash}>
                <td>
                  {shortAgent(s.userAgent)}
                  {s.current ? ' (cette session)' : ''}
                </td>
                <td>{s.ip && s.ip !== 'direct' ? s.ip : '—'}</td>
                <td>{formatDateTime(s.lastSeenAt)}</td>
                <td>
                  {s.current ? null : (
                    <button type="button" className="a-link" onClick={() => revoke(s.idHash)}>
                      Fermer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
