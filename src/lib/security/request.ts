import 'server-only';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { env } from '@/env';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly headers?: Record<string, string>,
  ) {
    super(message ?? code);
  }
}

export function json(data: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers },
  });
}

/** Réponse d'erreur : aucun détail interne ne sort jamais du serveur. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return json({ error: error.code, message: error.message }, error.status, error.headers);
  }
  console.error('[api] erreur interne', error instanceof Error ? error.name : 'inconnue');
  return json({ error: 'internal', message: 'Une erreur est survenue.' }, 500);
}

/**
 * IP du client. Seul l'en-tête désigné par l'administrateur est lu : `X-Forwarded-For`
 * est forgeable par n'importe qui et ne doit jamais servir à limiter un débit.
 */
export function clientIp(req: NextRequest): string {
  const header = env.TRUSTED_IP_HEADER;
  if (!header) return 'direct';
  const value = req.headers.get(header)?.split(',')[0]?.trim();
  if (!value || value.length > 64 || !/^[0-9a-fA-F:.]+$/.test(value)) return 'direct';
  return value;
}

export function userAgent(req: NextRequest): string {
  return (req.headers.get('user-agent') ?? '').replace(/[\r\n\t\0]/g, ' ').slice(0, 300);
}

/**
 * Anti-CSRF de premier niveau : l'origine doit être exactement la nôtre.
 * Fetch Metadata en plus : une requête intersite est rejetée même si Origin manque.
 */
export function assertSameOrigin(req: NextRequest): void {
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin') throw new HttpError(403, 'forbidden', 'Origine refusée.');
  const origin = req.headers.get('origin');
  if (!origin || origin !== env.APP_ORIGIN) throw new HttpError(403, 'forbidden', 'Origine refusée.');
}

/** Lit le corps en s'arrêtant dès que la limite est dépassée, même si Content-Length ment. */
export async function readBody(req: NextRequest, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new HttpError(413, 'too_large', 'Requête trop volumineuse.');
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, 'too_large', 'Requête trop volumineuse.');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** JSON strict : bon Content-Type (bloque les formulaires intersites), taille bornée, schéma validé. */
export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S, maxBytes = 256 * 1024): Promise<z.output<S>> {
  const type = (req.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'unsupported', 'Format non pris en charge.');
  const raw = await readBody(req, maxBytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
  } catch {
    throw new HttpError(400, 'bad_json', 'Requête invalide.');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    throw new HttpError(422, 'validation', first?.message ?? 'Données invalides.');
  }
  return result.data;
}
