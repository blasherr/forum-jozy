'use client';

import { useRouter } from 'next/navigation';
import { startTransition, useEffect, useRef } from 'react';

const INTERVAL = 2000;
const MAX_INTERVAL = 30000;

/**
 * Tient les pages ouvertes à jour sans rechargement. Une modification faite dans le panel apparaît
 * chez tous les visiteurs en 2 à 3 secondes, sans perdre leur position sur la page.
 * Choix d'une interrogation légère plutôt que d'une connexion permanente : elle fonctionne partout
 * (VPS comme Vercel) et n'offre pas de connexions longues à saturer. Elle s'arrête quand l'onglet est caché.
 */
export function LiveUpdates() {
  const router = useRouter();
  const known = useRef<{ v: number; t: number } | null>(null);

  useEffect(() => {
    let timer: number | undefined;
    let delay = INTERVAL;
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) throw new Error('indisponible');
        const next = (await res.json()) as { v: number; t: number };
        const previous = known.current;
        known.current = next;
        delay = INTERVAL;
        if (previous && next.t !== previous.t) {
          // Le thème change la feuille de style protégée par la CSP : il faut un vrai rechargement.
          window.location.reload();
          return;
        }
        if (previous && next.v !== previous.v) startTransition(() => router.refresh());
      } catch {
        delay = Math.min(delay * 2, MAX_INTERVAL);
      }
      if (!stopped) timer = window.setTimeout(check, delay);
    }

    const onVisible = () => {
      window.clearTimeout(timer);
      void check();
    };

    void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [router]);

  return null;
}
