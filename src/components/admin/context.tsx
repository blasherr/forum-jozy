'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

export type Role = 'owner' | 'admin' | 'editor';

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  raw?: Blob;
  headers?: Record<string, string>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

interface AdminValue {
  role: Role;
  name: string;
  api: <T = Record<string, unknown>>(url: string, options?: ApiOptions) => Promise<T>;
  toast: (message: string, tone?: 'ok' | 'error') => void;
  run: (action: () => Promise<void>, success?: string) => Promise<boolean>;
}

const AdminContext = createContext<AdminValue | null>(null);

export function useAdmin(): AdminValue {
  const value = useContext(AdminContext);
  if (!value) throw new Error('AdminProvider manquant');
  return value;
}

interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'error';
}

export function AdminProvider({
  csrf,
  role,
  name,
  children,
}: {
  csrf: string;
  role: Role;
  name: string;
  children: ReactNode;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sudoOpen, setSudoOpen] = useState(false);
  const [sudoError, setSudoError] = useState('');
  const pendingSudo = useRef<((ok: boolean) => void) | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'ok' ? 3200 : 7000);
  }, []);

  const send = useCallback(
    async <T,>(url: string, options: ApiOptions = {}): Promise<T> => {
      const method = options.method ?? (options.body !== undefined || options.raw ? 'POST' : 'GET');
      const headers: Record<string, string> = { 'X-CSRF-Token': csrf, ...options.headers };
      if (options.body !== undefined) headers['Content-Type'] = 'application/json';
      if (options.raw) headers['Content-Type'] = 'application/octet-stream';
      const res = await fetch(url, {
        method,
        headers,
        body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        if (res.status === 401) window.location.assign('/connexion');
        throw new ApiError(data.message ?? 'Erreur.', data.error ?? 'error', res.status);
      }
      return data as T;
    },
    [csrf],
  );

  /** Action sensible : si le serveur redemande le mot de passe, on l'affiche puis on rejoue la requête. */
  const api = useCallback(
    async <T,>(url: string, options?: ApiOptions): Promise<T> => {
      try {
        return await send<T>(url, options);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'sudo_required') {
          const confirmed = await new Promise<boolean>((resolve) => {
            pendingSudo.current = resolve;
            setSudoError('');
            setSudoOpen(true);
          });
          if (!confirmed) throw new ApiError('Action annulée.', 'cancelled', 0);
          return send<T>(url, options);
        }
        throw error;
      }
    },
    [send],
  );

  const run = useCallback(
    async (action: () => Promise<void>, success?: string) => {
      try {
        await action();
        if (success) toast(success);
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.code === 'cancelled') return false;
        toast(error instanceof Error ? error.message : 'Erreur.', 'error');
        return false;
      }
    },
    [toast],
  );

  async function confirmSudo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    try {
      await send('/api/admin/account', { body: { action: 'sudo', password } });
      setSudoOpen(false);
      pendingSudo.current?.(true);
    } catch (error) {
      setSudoError(error instanceof Error ? error.message : 'Erreur.');
    }
  }

  function cancelSudo() {
    setSudoOpen(false);
    pendingSudo.current?.(false);
  }

  const value = useMemo(() => ({ role, name, api, toast, run }), [role, name, api, toast, run]);

  return (
    <AdminContext.Provider value={value}>
      {children}
      {sudoOpen ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="sudo-title">
          <form className="modal-card" onSubmit={confirmSudo}>
            <h2 id="sudo-title">Confirmez votre mot de passe</h2>
            <p>Cette action est sensible : votre mot de passe est redemandé.</p>
            <label className="field">
              <span>Mot de passe</span>
              <input name="password" type="password" required autoFocus autoComplete="current-password" maxLength={256} />
            </label>
            {sudoError ? <p className="field-error">{sudoError}</p> : null}
            <div className="modal-actions">
              <button type="button" className="a-btn" onClick={cancelSudo}>
                Annuler
              </button>
              <button type="submit" className="a-btn a-btn-primary">
                Confirmer
              </button>
            </div>
          </form>
        </div>
      ) : null}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <p key={t.id} className={`toast toast-${t.tone}`}>
            {t.message}
          </p>
        ))}
      </div>
    </AdminContext.Provider>
  );
}
