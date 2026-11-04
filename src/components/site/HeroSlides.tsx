'use client';

import { useEffect, useRef, useState } from 'react';

const HOLD = 8000;

/**
 * Diaporama du bandeau. Seule la première image est dans le HTML ; les suivantes arrivent après
 * l'affichage, et le fondu ne démarre qu'une fois l'image décodée : jamais de saut ni de flash.
 */
export function HeroSlides({ ids }: { ids: string[] }) {
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const current = useRef(0);

  useEffect(() => {
    if (ids.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const delay = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(delay);
  }, [ids.length]);

  useEffect(() => {
    if (!ready) return undefined;
    const timer = window.setInterval(async () => {
      if (document.hidden) return;
      const next = (current.current + 1) % ids.length;
      const image = new Image();
      image.src = `/media/${ids[next]}`;
      await image.decode().catch(() => undefined);
      current.current = next;
      setActive(next);
    }, HOLD);
    return () => window.clearInterval(timer);
  }, [ready, ids]);

  return (
    <>
      {ids.map((id, i) =>
        i === 0 || ready ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={id}
            className={`hero-scene hero-slide ${i === active ? 'on' : ''}`}
            src={`/media/${id}`}
            alt=""
            decoding="async"
            fetchPriority={i === 0 ? 'high' : 'low'}
          />
        ) : null,
      )}
    </>
  );
}
