import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, count, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { entries, navItems, revisions, settings, siteVersion, type Collection } from '@/db/schema';
import { HttpError } from '@/lib/security/request';
import type { EntryInput, SettingKey } from './schemas';

/** Plafond d'entrées par module : un compte compromis ne peut pas remplir la base. */
const QUOTAS: Record<Collection, number> = { rules: 50, lore: 50, guide: 200, patchnotes: 1000, pages: 100 };

const MAX_REVISIONS = 40;
const KEEP_MS = 30 * 24 * 3600 * 1000;
const MIN_GAP_MS = 5 * 60 * 1000;

/**
 * Historique. Aucune version de moins de 30 jours n'est purgée : enregistrer 41 fois de suite ne permet
 * pas d'effacer un contenu sans en avoir le droit. Une rafale d'enregistrements d'un même compte
 * ne crée qu'une version toutes les 5 minutes, ce qui borne la croissance de la base.
 */
async function addRevision(subject: string, snapshot: unknown, userId: string, note?: string) {
  const now = Date.now();
  if (!note) {
    const last = await db
      .select({ createdAt: revisions.createdAt })
      .from(revisions)
      .where(and(eq(revisions.subject, subject), eq(revisions.createdBy, userId)))
      .orderBy(desc(revisions.createdAt))
      .limit(1);
    if (last[0] && now - last[0].createdAt < MIN_GAP_MS) return;
  }
  await db.insert(revisions).values({ id: randomUUID(), subject, snapshot, createdBy: userId, note: note ?? null });
  const rows = await db
    .select({ id: revisions.id, createdAt: revisions.createdAt })
    .from(revisions)
    .where(eq(revisions.subject, subject))
    .orderBy(desc(revisions.createdAt))
    .limit(1000)
    .offset(MAX_REVISIONS);
  const old = rows.filter((r) => now - r.createdAt > KEEP_MS);
  if (old.length > 0) {
    await db.delete(revisions).where(inArray(revisions.id, old.map((r) => r.id)));
  }
}

/** Signale un changement : les pages ouvertes chez les visiteurs se mettent à jour d'elles-mêmes. */
export async function bumpVersion(theme = false) {
  await db
    .update(siteVersion)
    .set({
      content: sql`${siteVersion.content} + 1`,
      ...(theme ? { theme: sql`${siteVersion.theme} + 1` } : {}),
    })
    .where(eq(siteVersion.id, 1));
}

export async function saveSetting(key: SettingKey, value: unknown, userId: string) {
  const now = Date.now();
  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (existing[0]) await addRevision(`setting:${key}`, existing[0].value, userId);
  await db
    .insert(settings)
    .values({ key, value, updatedAt: now, updatedBy: userId })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now, updatedBy: userId } });
  await bumpVersion(key === 'theme');
}

async function assertSlugFree(collection: Collection, slug: string, exceptId?: string) {
  const rows = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        eq(entries.collection, collection),
        eq(entries.slug, slug),
        ...(exceptId ? [ne(entries.id, exceptId)] : []),
      ),
    )
    .limit(1);
  if (rows[0]) throw new HttpError(409, 'slug_taken', 'Cet identifiant d’URL est déjà utilisé.');
}

function cleanMeta(meta: EntryInput['meta']): Record<string, string> {
  return Object.fromEntries(Object.entries(meta).filter(([, v]) => typeof v === 'string' && v.length > 0)) as Record<
    string,
    string
  >;
}

export async function createEntry(collection: Collection, input: EntryInput, userId: string): Promise<string> {
  await assertSlugFree(collection, input.slug);
  const id = randomUUID();
  const now = Date.now();
  const maxRow = await db
    .select({ max: sql<number>`coalesce(max(${entries.position}), -1)`, total: count() })
    .from(entries)
    .where(eq(entries.collection, collection));
  if (Number(maxRow[0]?.total ?? 0) >= QUOTAS[collection]) {
    throw new HttpError(409, 'quota', 'Limite atteinte pour ce module : supprimez d’anciennes entrées.');
  }
  await db.insert(entries).values({
    id,
    collection,
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    body: input.body,
    meta: cleanMeta(input.meta),
    status: input.status,
    position: Number(maxRow[0]?.max ?? -1) + 1,
    publishedAt: input.publishedAt ?? (input.status === 'published' ? now : null),
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  });
  await bumpVersion();
  return id;
}

export async function updateEntry(id: string, input: EntryInput, userId: string): Promise<void> {
  const rows = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  const current = rows[0];
  if (!current) throw new HttpError(404, 'not_found', 'Contenu introuvable.');
  await assertSlugFree(current.collection, input.slug, id);
  await addRevision(`entry:${id}`, current, userId, input.note);
  const now = Date.now();
  await db
    .update(entries)
    .set({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      meta: cleanMeta(input.meta),
      status: input.status,
      publishedAt: input.publishedAt ?? current.publishedAt ?? (input.status === 'published' ? now : null),
      updatedAt: now,
      updatedBy: userId,
    })
    .where(eq(entries.id, id));
  await bumpVersion();
}

export async function deleteEntry(id: string, userId: string): Promise<void> {
  const rows = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  const current = rows[0];
  if (!current) throw new HttpError(404, 'not_found', 'Contenu introuvable.');
  await addRevision(`entry:${id}`, current, userId, 'Suppression');
  await db.delete(entries).where(eq(entries.id, id));
  await bumpVersion();
}

export async function reorderEntries(collection: Collection, ids: string[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(entries)
        .set({ position })
        .where(and(eq(entries.id, id), eq(entries.collection, collection)));
    }
  });
  await bumpVersion();
}

export async function saveNav(
  items: { id?: string; label: string; href: string; visible: boolean; newTab: boolean }[],
): Promise<void> {
  await db.transaction(async (tx) => {
    const kept: string[] = [];
    for (const [position, item] of items.entries()) {
      const id = item.id ?? randomUUID();
      kept.push(id);
      await tx
        .insert(navItems)
        .values({ id, label: item.label, href: item.href, position, visible: item.visible, newTab: item.newTab })
        .onConflictDoUpdate({
          target: navItems.id,
          set: { label: item.label, href: item.href, position, visible: item.visible, newTab: item.newTab },
        });
    }
    if (kept.length === 0) await tx.delete(navItems);
    else await tx.delete(navItems).where(notInArray(navItems.id, kept));
  });
  await bumpVersion();
}
