import { desc, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { media } from '@/db/schema';
import { MAX_UPLOAD_BYTES, storeImage } from '@/lib/content/media';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { hit } from '@/lib/security/ratelimit';
import { HttpError, json, readBody } from '@/lib/security/request';

export const GET = adminRoute({ role: 'editor' }, async () => {
  const rows = await db
    .select({
      id: media.id,
      filename: media.filename,
      alt: media.alt,
      width: media.width,
      height: media.height,
      bytes: media.bytes,
    })
    .from(media)
    .orderBy(desc(media.createdAt))
    .limit(300);
  return json({ media: rows.map((m) => ({ ...m, url: `/media/${m.id}` })) });
});

/** Corps brut (pas de multipart à analyser) : l'image seule, nom et texte alternatif dans des en-têtes encodés. */
export const POST = adminRoute({ role: 'editor' }, async ({ req, user }) => {
  const limit = await hit('upload', user.id, 30, 60 * 60 * 1000);
  if (!limit.allowed) throw new HttpError(429, 'rate_limited', 'Trop d’envois. Réessayez plus tard.');

  const total = await db.select({ size: sql<number>`coalesce(sum(${media.bytes}), 0)` }).from(media);
  if (Number(total[0]?.size ?? 0) > 2 * 1024 * 1024 * 1024) {
    throw new HttpError(507, 'storage_full', 'Médiathèque pleine (2 Go). Supprimez des images.');
  }

  const type = (req.headers.get('content-type') ?? '').split(';')[0]?.trim();
  if (type !== 'application/octet-stream') throw new HttpError(415, 'unsupported', 'Format non pris en charge.');
  const raw = await readBody(req, MAX_UPLOAD_BYTES);

  const decode = (name: string) => {
    try {
      return decodeURIComponent(req.headers.get(name) ?? '').slice(0, 300);
    } catch {
      return '';
    }
  };
  const stored = await storeImage(Buffer.from(raw), decode('x-file-name'), decode('x-file-alt'), user.id);
  await audit({ action: 'media.upload', req, user, target: stored.id, meta: { bytes: raw.byteLength } });
  return json({ ok: true, ...stored }, 201);
});
