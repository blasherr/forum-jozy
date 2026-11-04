import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * En-têtes appliqués à TOUTES les réponses, y compris les fichiers statiques
 * que le proxy ne voit pas. La CSP (avec nonce) est posée par src/proxy.ts.
 */
const baseHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value:
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Origin-Agent-Cluster', value: '?1' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // L'optimiseur d'images a été la source de plusieurs RCE (CVE-2026-96889) : il est coupé.
  // Les images sont réencodées dès l'envoi (src/lib/content/media.ts).
  images: { unoptimized: true },
  // Les pages déjà préchargées s'ouvrent sans attendre ; LiveUpdates les rafraîchit dès qu'un contenu change.
  experimental: { staleTimes: { dynamic: 60, static: 300 } },
  serverExternalPackages: ['@libsql/client', 'libsql', 'sharp', '@node-rs/argon2'],
  turbopack: { root: path.resolve(process.cwd()) },
  async headers() {
    return [
      { source: '/:path*', headers: baseHeaders },
      // Décors et vidéo : gardés une semaine par le navigateur pour un affichage immédiat.
      {
        source: '/:dir(video|textures|art|brand)/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },
};

export default nextConfig;
