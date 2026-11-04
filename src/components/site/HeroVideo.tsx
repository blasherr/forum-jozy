'use client';

import { useEffect, useRef } from 'react';

/**
 * Vidéo d'accueil en boucle, comme un GIF : le fichier n'a aucune piste audio.
 * Elle ne tourne que si le bandeau est à l'écran, et reste sur l'image fixe si le visiteur
 * a demandé moins d'animations ou active l'économie de données.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return undefined;
    video.muted = true;

    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || connection?.saveData) return undefined;

    let inView = false;
    const sync = () => {
      if (inView && document.visibilityState === 'visible') void video.play().catch(() => undefined);
      else video.pause();
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = Boolean(entry?.isIntersecting);
      sync();
    });
    observer.observe(video);
    // Un onglet ouvert en arrière-plan doit démarrer dès qu'il est affiché.
    document.addEventListener('visibilitychange', sync);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return (
    <video
      ref={ref}
      className="hero-scene hero-video"
      poster="/video/hero-poster.webp"
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      tabIndex={-1}
    >
      <source src="/video/hero-960.mp4" type="video/mp4" media="(max-width: 760px)" />
      <source src="/video/hero-1920.mp4" type="video/mp4" />
    </video>
  );
}
