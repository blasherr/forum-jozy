/** Schémas autorisés pour tous les liens et boutons du site. `javascript:`, `data:`, etc. sont refusés. */
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/**
 * Renvoie le lien s'il est sûr, sinon null.
 * Le contrôle est fait à l'écriture ET à l'affichage.
 */
export function safeHref(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (value.length === 0 || value.length > 2048) return null;
  // Caractères de contrôle, espaces et antislashs : base des contournements « java\tscript: » et « /\evil.com ».
  // eslint-disable-next-line no-control-regex
  if (/[\u0000- \u007f-\u009f\\]/.test(value)) return null;

  if (value.startsWith('#')) return /^#[\w-]{1,120}$/.test(value) ? value : null;
  if (value.startsWith('/')) {
    // « //evil.com » est une URL absolue déguisée.
    if (value.startsWith('//')) return null;
    return /^\/[\w\-./~%?&=+#:,;@!$'()*]*$/.test(value) ? value : null;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
  if (url.username || url.password) return null;
  return value;
}

export const isExternal = (href: string): boolean => !href.startsWith('/') && !href.startsWith('#');

const MEDIA_RE = /^\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Seules les images de notre propre médiathèque peuvent être affichées dans un contenu. */
export function safeImageSrc(input: unknown): string | null {
  return typeof input === 'string' && MEDIA_RE.test(input) ? input : null;
}
