import 'server-only';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '@/db/client';
import { media } from '@/db/schema';
import { HttpError } from '@/lib/security/request';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_EDGE = 2560;

// SVG, PDF, etc. sont interdits au niveau de la bibliothèque (CVE-2026-96889 passait par librsvg).
sharp.block({ operation: ['VipsForeignLoadSvg', 'VipsForeignLoadPdf', 'VipsForeignLoadMagick', 'VipsForeignLoadHeif', 'VipsForeignLoadJxl', 'VipsForeignLoadOpenslide', 'VipsForeignLoadMatrix', 'VipsForeignLoadVips', 'VipsForeignLoadFits', 'VipsForeignLoadRaw', 'VipsForeignLoadAnalyze', 'VipsForeignLoadPpm', 'VipsForeignLoadCsv'] });
sharp.cache(false);
sharp.concurrency(2);

/** Signature réelle du fichier : l'extension et le Content-Type envoyés par le client sont ignorés. */
function sniff(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.subarray(0, 4).toString('latin1') === 'RIFF' && buffer.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'webp';
  }
  return null;
}

/**
 * L'image est entièrement décodée puis réencodée : les métadonnées (EXIF, GPS) et tout contenu
 * caché (polyglotte PHP/HTML, charge après la fin de fichier) disparaissent.
 * Ce qui est stocké n'est jamais le fichier envoyé.
 */
export async function storeImage(input: Buffer, filename: string, alt: string, userId: string) {
  if (input.length > MAX_UPLOAD_BYTES) throw new HttpError(413, 'too_large', 'Image trop lourde (8 Mo maximum).');
  const format = sniff(input);
  if (!format) throw new HttpError(415, 'bad_image', 'Formats acceptés : JPEG, PNG, WebP.');

  let output: { data: Buffer; info: { width: number; height: number } };
  try {
    const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'error', animated: false })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 });
    output = await pipeline.toBuffer({ resolveWithObject: true });
  } catch {
    throw new HttpError(415, 'bad_image', 'Image illisible ou corrompue.');
  }

  const id = randomUUID();
  const safeName = filename.replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120) || 'image';
  await db.insert(media).values({
    id,
    filename: safeName,
    alt: alt.slice(0, 300),
    mime: 'image/webp',
    width: output.info.width,
    height: output.info.height,
    bytes: output.data.length,
    data: output.data,
    createdBy: userId,
  });
  return { id, url: `/media/${id}`, width: output.info.width, height: output.info.height };
}
