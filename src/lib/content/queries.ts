import 'server-only';
import { and, asc, desc, eq } from 'drizzle-orm';
import { cache } from 'react';
import { db, dbReady } from '@/db/client';
import { entries, navItems, settings, type Collection, type Entry } from '@/db/schema';
import type { RichDoc } from '@/lib/richtext/types';
import { sanitizeDoc } from '@/lib/richtext/validate';
import { DEFAULT_NAV, DEFAULT_SETTINGS } from './defaults';
import { settingSchemas, type SettingKey, type SettingsMap } from './schemas';

/** Lecture d'un réglage : une valeur corrompue ne casse pas le site, on retombe sur le contenu d'origine. */
export const getSetting = cache(async <K extends SettingKey>(key: K): Promise<SettingsMap[K]> => {
  await dbReady();
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  const raw = rows[0]?.value;
  if (raw === undefined) return DEFAULT_SETTINGS[key];
  const parsed = settingSchemas[key].safeParse(raw);
  return parsed.success ? (parsed.data as SettingsMap[K]) : DEFAULT_SETTINGS[key];
});

export const getNav = cache(async () => {
  await dbReady();
  const rows = await db.select().from(navItems).orderBy(asc(navItems.position));
  if (rows.length === 0) {
    return DEFAULT_NAV.map((n, i) => ({ id: String(i), ...n, position: i, visible: true, newTab: false }));
  }
  return rows;
});

export type PublicEntry = Omit<Entry, 'body'> & { body: RichDoc };
export type EntrySummary = Omit<Entry, 'body' | 'updatedBy'>;

/** Colonnes des listes : jamais le corps des documents, pour qu'une liste reste légère quoi qu'il arrive. */
const SUMMARY = {
  id: entries.id,
  collection: entries.collection,
  slug: entries.slug,
  title: entries.title,
  summary: entries.summary,
  meta: entries.meta,
  position: entries.position,
  status: entries.status,
  publishedAt: entries.publishedAt,
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
};

const orderFor = (collection: Collection) =>
  collection === 'patchnotes'
    ? [desc(entries.publishedAt), desc(entries.createdAt)]
    : [asc(entries.position), asc(entries.title)];

/** Le document est revalidé à la lecture aussi : même une base altérée ne peut rien injecter. */
function hydrate(entry: Entry): PublicEntry {
  let body: RichDoc;
  try {
    body = sanitizeDoc(entry.body);
  } catch {
    body = { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return { ...entry, body };
}

export const listSummaries = cache(async (collection: Collection): Promise<EntrySummary[]> => {
  await dbReady();
  return db
    .select(SUMMARY)
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.status, 'published')))
    .orderBy(...orderFor(collection))
    .limit(500);
});

/** Documents complets : réservé à la recherche, seule à en avoir besoin. */
export const listPublished = cache(async (collection: Collection): Promise<PublicEntry[]> => {
  await dbReady();
  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.status, 'published')))
    .orderBy(...orderFor(collection));
  return rows.map(hydrate);
});

export const getPublished = cache(async (collection: Collection, slug: string): Promise<PublicEntry | null> => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  await dbReady();
  const rows = await db
    .select()
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.slug, slug), eq(entries.status, 'published')))
    .limit(1);
  return rows[0] ? hydrate(rows[0]) : null;
});

export async function listAllSummaries(collection: Collection): Promise<EntrySummary[]> {
  await dbReady();
  return db
    .select(SUMMARY)
    .from(entries)
    .where(eq(entries.collection, collection))
    .orderBy(...orderFor(collection))
    .limit(1000);
}

export async function getEntryById(id: string): Promise<PublicEntry | null> {
  await dbReady();
  const rows = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  return rows[0] ? hydrate(rows[0]) : null;
}
