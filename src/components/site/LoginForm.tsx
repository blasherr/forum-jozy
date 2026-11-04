'use client';

import { useState, type FormEvent } from 'react';

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; mfa?: boolean };
  return { ok: res.ok, data };
}

export function LoginForm({ needsCode }: { needsCode: boolean }) {
  const [step, setStep] = useState<'password' | 'code'>(needsCode ? 'code' : 'password');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (step === 'password') {
        const { ok, data } = await post('/api/auth/login', {
          email: String(form.get('email') ?? ''),
          password: String(form.get('password') ?? ''),
        });
        if (!ok) return setError(data.message ?? 'Connexion impossible.');
        if (data.mfa) {
          event.currentTarget?.reset();
          return setStep('code');
        }
      } else {
        const { ok, data } = await post('/api/auth/mfa', { code: String(form.get('code') ?? '') });
        if (!ok) return setError(data.message ?? 'Code invalide.');
      }
      // Rechargement complet : le panel doit démarrer avec sa propre politique CSP.
      window.location.assign('/admin');
    } catch {
      setError('Le serveur ne répond pas. Réessayez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit} autoComplete="on">
      {step === 'password' ? (
        <>
          <label>
            Adresse e-mail
            <input name="email" type="email" required autoComplete="username" maxLength={254} spellCheck={false} />
          </label>
          <label>
            Mot de passe
            <input name="password" type="password" required autoComplete="current-password" maxLength={256} />
          </label>
        </>
      ) : (
        <label>
          Code de votre application d’authentification
          <input
            name="code"
            required
            autoFocus
            autoComplete="one-time-code"
            inputMode="text"
            maxLength={20}
            spellCheck={false}
            placeholder="123456 ou code de secours"
          />
        </label>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? 'Vérification…' : step === 'password' ? 'Entrer' : 'Valider le code'}
      </button>
    </form>
  );
}
