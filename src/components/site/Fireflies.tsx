'use client';

import { useEffect, useRef } from 'react';

interface Fly {
  x: number;
  y: number;
  phase: number;
  speed: number;
  wander: number;
  size: number;
  blink: number;
}

/**
 * Lucioles au-dessus de l'eau : trajectoires lentes et clignotement irrégulier.
 * Dessin sur canvas, s'arrête dès que le bandeau sort de l'écran ou que l'onglet est caché,
 * et ne démarre pas du tout si le visiteur a demandé moins d'animations.
 */
export function Fireflies() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    const glow = document.createElement('canvas');
    glow.width = glow.height = 64;
    const g = glow.getContext('2d');
    if (!g) return undefined;
    const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,244,190,1)');
    gradient.addColorStop(0.12, 'rgba(255,222,130,0.85)');
    gradient.addColorStop(0.4, 'rgba(255,190,90,0.2)');
    gradient.addColorStop(1, 'rgba(255,170,70,0)');
    g.fillStyle = gradient;
    g.fillRect(0, 0, 64, 64);

    let width = 0;
    let height = 0;
    let visible = true;
    let frame = 0;
    let last = performance.now();

    const count = window.innerWidth < 700 ? 12 : 26;
    const flies: Fly[] = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: 0.42 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.006 + Math.random() * 0.012,
      wander: Math.random() * Math.PI * 2,
      size: 7 + Math.random() * 10,
      blink: 0.5 + Math.random() * 0.9,
    }));

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      frame = 0;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = 'lighter';
      for (const fly of flies) {
        fly.wander += dt * (0.6 + Math.sin(now / 2300 + fly.phase) * 0.9);
        fly.x += Math.cos(fly.wander) * fly.speed * dt;
        fly.y += Math.sin(fly.wander * 0.7) * fly.speed * 0.7 * dt;
        if (fly.x < -0.03) fly.x = 1.03;
        if (fly.x > 1.03) fly.x = -0.03;
        fly.y = Math.min(0.95, Math.max(0.38, fly.y));
        // Un clignotement de luciole : montée douce, puis longue extinction.
        const pulse = Math.max(0, Math.sin(now / 1000 * fly.blink + fly.phase));
        const alpha = pulse ** 3;
        if (alpha < 0.02) continue;
        ctx!.globalAlpha = alpha;
        const size = fly.size * (0.8 + alpha * 0.4);
        ctx!.drawImage(glow, fly.x * width - size, fly.y * height - size, size * 2, size * 2);
      }
      ctx!.globalAlpha = 1;
      if (visible) frame = requestAnimationFrame(draw);
    }

    const start = () => {
      if (visible && !frame && document.visibilityState === 'visible') {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      start();
    });
    observer.observe(canvas);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', start);
    resize();
    start();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', start);
    };
  }, []);

  return <canvas ref={ref} className="hero-fireflies" aria-hidden="true" />;
}
