import { desc } from 'drizzle-orm';
import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { db } from '@/db/client';
import { media } from '@/db/schema';
import { requirePage } from '@/lib/security/page-guard';

export default async function AdminMedia() {
  await requirePage();
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
  return <MediaLibrary initial={rows.map((m) => ({ ...m, url: `/media/${m.id}` }))} />;
}
