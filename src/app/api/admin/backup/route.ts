import { asc } from 'drizzle-orm';
import { db } from '@/db/client';
import { entries, media, navItems, settings } from '@/db/schema';
import { audit } from '@/lib/security/audit';
import { adminRoute } from '@/lib/security/guard';
import { json } from '@/lib/security/request';

/**
 * Export JSON du contenu. Ne contient NI comptes, NI sessions, NI secrets 2FA :
 * un fichier de sauvegarde égaré ne donne aucun accès.
 */
export const GET = adminRoute({ role: 'owner', sudo: true }, async ({ req, user }) => {
  const [allSettings, nav, allEntries, images] = await Promise.all([
    db.select().from(settings),
    db.select().from(navItems).orderBy(asc(navItems.position)),
    db.select().from(entries),
    db.select({ id: media.id, filename: media.filename, alt: media.alt, bytes: media.bytes }).from(media),
  ]);
  await audit({ action: 'backup.export', req, user });
  return json(
    { exportedAt: new Date().toISOString(), settings: allSettings, nav, entries: allEntries, media: images },
    200,
    { 'Content-Disposition': `attachment; filename="new-frontier-${new Date().toISOString().slice(0, 10)}.json"` },
  );
});
