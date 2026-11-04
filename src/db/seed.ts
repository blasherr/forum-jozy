import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { DEFAULT_NAV, DEFAULT_SETTINGS } from '../lib/content/defaults';
import { settingSchemas, type SettingKey } from '../lib/content/schemas';
import { sanitizeDoc } from '../lib/richtext/validate';
import { db } from './client';
import { entries, media, navItems, settings, type Collection } from './schema';

interface SeedEntry {
  slug: string;
  title: string;
  summary: string;
  body: unknown;
  category?: string;
  author?: string;
  publishedAt?: number;
}

const SEED_IMAGES: [string, string, string][] = [
  ['00000000-0000-4000-8000-000000000001', 'volume-1.png', 'Mélangeur de volume Windows'],
  ['00000000-0000-4000-8000-000000000002', 'volume-2.png', 'Volume de RedM Chromium subprocess'],
  ['00000000-0000-4000-8000-000000000011', 'photo-1.webp', 'Le saloon du Bastille à Saint Denis'],
  ['00000000-0000-4000-8000-000000000012', 'photo-2.webp', 'Un village au milieu des arbres'],
  ['00000000-0000-4000-8000-000000000013', 'photo-3.webp', 'Une ville sous les nuages, montagnes au loin'],
  ['00000000-0000-4000-8000-000000000014', 'photo-4.webp', 'Un campement au pied des sommets enneigés'],
  ['00000000-0000-4000-8000-000000000015', 'photo-5.webp', 'Les pics enneigés de l’Ambarino'],
  ['00000000-0000-4000-8000-000000000016', 'photo-6.webp', 'Un hameau sous la tempête de neige'],
  ['00000000-0000-4000-8000-000000000017', 'photo-7.webp', 'Une ville portuaire au bord du lac'],
];

/** Remplit une base vide avec le contenu d'origine. Ne touche à rien si du contenu existe déjà. */
export async function seed(): Promise<boolean> {
  const existing = await db.select({ id: entries.id }).from(entries).limit(1);
  if (existing.length > 0) return false;

  const root = path.join(process.cwd(), 'src/db/seed-data');
  const content = JSON.parse(readFileSync(path.join(root, 'content.json'), 'utf8')) as Record<
    'rules' | 'lore' | 'guide' | 'patchnotes',
    SeedEntry[]
  >;

  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingKey[]) {
    const value = settingSchemas[key].parse(DEFAULT_SETTINGS[key]);
    await db.insert(settings).values({ key, value });
  }

  await db.insert(navItems).values(
    DEFAULT_NAV.map((n, position) => ({ id: randomUUID(), label: n.label, href: n.href, position })),
  );

  const groups: [Collection, SeedEntry[]][] = [
    ['rules', content.rules],
    ['lore', content.lore],
    ['guide', content.guide],
    ['patchnotes', content.patchnotes],
  ];
  const now = Date.now();
  for (const [collection, items] of groups) {
    for (const [position, item] of items.entries()) {
      const meta: Record<string, string> = {};
      if (item.category) meta.category = item.category;
      if (item.author) meta.author = item.author;
      await db.insert(entries).values({
        id: randomUUID(),
        collection,
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        body: sanitizeDoc(item.body),
        meta,
        position,
        status: 'published',
        publishedAt: item.publishedAt ?? now,
      });
    }
  }

  for (const [id, file, alt] of SEED_IMAGES) {
    const source = readFileSync(path.join(root, 'img', file));
    const { data, info } = await sharp(source).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
    await db.insert(media).values({
      id,
      filename: file.replace(/\.(png|webp)$/, '.webp'),
      alt,
      mime: 'image/webp',
      width: info.width,
      height: info.height,
      bytes: data.length,
      data,
    });
  }
  return true;
}
