import { NextResponse, type NextRequest } from 'next/server';

const isDev = process.env.NODE_ENV !== 'production';

/** En-têtes internes de Next : un client ne doit jamais pouvoir les forger (CVE-2025-29927 et suivantes). */
const INTERNAL_HEADERS = [
  'x-middleware-subrequest',
  'x-middleware-rewrite',
  'x-middleware-next',
  'x-middleware-override-headers',
  'x-middleware-set-cookie',
  'x-nextjs-data',
  'x-invoke-path',
  'x-invoke-query',
  'x-invoke-status',
  'x-matched-path',
  'x-now-route-matches',
];

function csp(nonce: string, publicPage: boolean): string {
  const https = (process.env.APP_ORIGIN ?? '').startsWith('https://');
  const directives = [
    `default-src 'none'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // En développement seulement, Next injecte ses styles à la volée.
    isDev ? `style-src 'self' 'unsafe-inline'` : `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' blob:`,
    `font-src 'self'`,
    `connect-src 'self'${isDev ? ' ws:' : ''}`,
    `manifest-src 'self'`,
    `media-src 'self'`,
    `object-src 'none'`,
    `frame-src 'none'`,
    `worker-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ];
  if (https) directives.push('upgrade-insecure-requests');
  // Trusted Types : bloque au niveau du navigateur toute écriture de HTML brut dans le DOM.
  // L'éditeur du panel (ProseMirror) en a besoin pour le copier-coller : il reste hors périmètre.
  // La seule politique admise est celle de public/tt-policy.js.
  if (!isDev && publicPage) directives.push(`require-trusted-types-for 'script'`, `trusted-types default`);
  return directives.join('; ');
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /**
   * Le site n'utilise AUCUNE Server Action : toute écriture passe par /api, avec contrôles explicites.
   * Refuser le reste éloigne le décodeur Flight, cible de React2Shell (CVE-2025-55182) et du
   * déni de service GHSA-p3m5-59mp-jv5r. Le filtre s'applique à tous les chemins, sauf /_next/static/.
   */
  const method = req.method.toUpperCase();
  if (req.headers.has('next-action')) {
    return new NextResponse(null, { status: 403 });
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (method === 'TRACE' || method === 'TRACK' || method === 'CONNECT') {
    return new NextResponse(null, { status: 405 });
  }

  /** Protection contre l'empoisonnement par en-tête Host. */
  const origin = process.env.APP_ORIGIN;
  if (origin) {
    const expected = new URL(origin).host;
    const host = req.headers.get('host');
    if (!isDev && host !== expected) {
      return new NextResponse(null, { status: 421 });
    }
  }

  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
  const isPanel = pathname.startsWith('/admin') || pathname.startsWith('/apercu');
  // Une image servie seule ne doit rien pouvoir exécuter, même ouverte directement.
  const policy = pathname.startsWith('/media/') ? `default-src 'none'; sandbox` : csp(nonce, !isPanel);

  const requestHeaders = new Headers(req.headers);
  for (const name of INTERNAL_HEADERS) requestHeaders.delete(name);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);

  const isPrivate =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/connexion') ||
    pathname.startsWith('/apercu');
  if (isPrivate) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  // Seuls les fichiers de build, immuables et sans logique serveur, échappent au proxy.
  matcher: [{ source: '/((?!_next/static/).*)' }],
};
