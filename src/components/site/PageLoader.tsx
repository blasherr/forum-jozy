'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Durée d'affichage minimale, pour que l'écran se lise sans ralentir la visite. */
const MIN_MS = 800;
/** Filet de sécurité : si une page ne répond pas, le site ne reste jamais bloqué derrière l'écran. */
const MAX_MS = 5000;
const BOOT_MS = 1300;

function isPageLink(link: HTMLAnchorElement): boolean {
  if (link.target === '_blank' || link.hasAttribute('download')) return false;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname) return false;
  return !/^\/(media|api|textures|art|brand|video)\//.test(url.pathname);
}

/**
 * Écran de chargement, comme entre deux zones d'un jeu. Il couvre le changement de page,
 * y compris avec le bouton Retour et les flèches du navigateur. Sans JavaScript, la version
 * affichée à l'ouverture disparaît d'elle-même : le contenu reste toujours accessible.
 */
export function PageLoader({ tips, images }: { tips: string[]; images: string[] }) {
  const pathname = usePathname();
  const [state, setState] = useState<'boot' | 'on' | 'off'>('boot');
  const [run, setRun] = useState(0);
  const startedAt = useRef(0);
  const waiting = useRef(false);
  const currentPath = useRef(pathname);
  const hideTimer = useRef<number | undefined>(undefined);
  const safetyTimer = useRef<number | undefined>(undefined);

  const start = useCallback(() => {
    window.clearTimeout(hideTimer.current);
    window.clearTimeout(safetyTimer.current);
    startedAt.current = performance.now();
    waiting.current = true;
    setRun((n) => n + 1 + Math.floor(Math.random() * 3));
    setState('on');
    safetyTimer.current = window.setTimeout(() => {
      waiting.current = false;
      setState('off');
    }, MAX_MS);
  }, []);

  // La nouvelle page est là : on laisse l'écran le temps minimal, puis il s'efface.
  useEffect(() => {
    currentPath.current = pathname;
    if (!waiting.current) return;
    waiting.current = false;
    window.clearTimeout(safetyTimer.current);
    const elapsed = performance.now() - startedAt.current;
    hideTimer.current = window.setTimeout(() => setState('off'), Math.max(0, MIN_MS - elapsed));
  }, [pathname]);

  useEffect(() => {
    const boot = window.setTimeout(() => setState((s) => (s === 'boot' ? 'off' : s)), BOOT_MS);

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as HTMLElement).closest?.('a[href]');
      if (link instanceof HTMLAnchorElement && isPageLink(link)) start();
    };

    // Les ancres internes déclenchent aussi popstate : seul un vrai changement de page compte.
    const onHistory = () => {
      if (window.location.pathname !== currentPath.current) start();
    };

    // Ctrl + clic et clic molette ouvrent un autre onglet : rien à afficher ici.
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onHistory);

    // Les images sont préparées en arrière-plan : l'écran s'affiche complet dès la première fois.
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!connection?.saveData) {
      for (const id of images) {
        const image = new Image();
        image.src = `/media/${id}`;
      }
    }

    return () => {
      window.clearTimeout(boot);
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onHistory);
    };
  }, [images, start]);

  const tip = tips.length > 0 ? tips[run % tips.length] : '';
  const image = images.length > 0 ? images[run % images.length] : undefined;

  return (
    <div className={`loader loader-${state}`} aria-hidden={state === 'off'}>
      <div className="loader-scene" key={run}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img className="loader-img" src={`/media/${image}`} alt="" /> : null}
        <div className="loader-shade" />
        <div className="loader-center" role="status">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="loader-mark" src="/brand/nf-mark.webp" alt="" width={974} height={737} />
          <p className="loader-label">Chargement</p>
          <span className="loader-fuse" aria-hidden="true">
            <i />
          </span>
          {tip ? <p className="loader-tip">{tip}</p> : null}
        </div>
      </div>
    </div>
  );
}
