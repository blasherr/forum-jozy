import { eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db, dbReady } from '@/db/client';
import { media } from '@/db/schema';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Sert les images de la médiathèque. Toujours du WebP réencodé par nos soins, jamais le fichier
 * d'origine. `nosniff` + `sandbox` : même un contenu détourné ne pourrait pas s'exécuter ici.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  await dbReady();
  const rows = await db
    .select({ data: media.data, mime: media.mime, bytes: media.bytes })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);
  const file = rows[0];
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(file.bytes),
      'Cache-Control': 'public, max-age=86400, must-revalidate',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
