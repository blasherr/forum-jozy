import type { MetadataRoute } from 'next';
import { listSummaries } from '@/lib/content/queries';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = process.env.APP_ORIGIN ?? 'http://localhost:3000';
  const [rules, guide, notes, lore, pages] = await Promise.all([
    listSummaries('rules'),
    listSummaries('guide'),
    listSummaries('patchnotes'),
    listSummaries('lore'),
    listSummaries('pages'),
  ]);
  const fixed = ['', '/histoire', '/reglement', '/guide', '/patch-notes', '/discord'];
  return [
    ...fixed.map((path) => ({ url: `${origin}${path}` })),
    ...rules.map((e) => ({ url: `${origin}/reglement/${e.slug}`, lastModified: new Date(e.updatedAt) })),
    ...guide.map((e) => ({ url: `${origin}/guide/${e.slug}`, lastModified: new Date(e.updatedAt) })),
    ...notes.map((e) => ({ url: `${origin}/patch-notes/${e.slug}`, lastModified: new Date(e.updatedAt) })),
    ...lore.map((e) => ({ url: `${origin}/histoire/${e.slug}`, lastModified: new Date(e.updatedAt) })),
    ...pages.map((e) => ({ url: `${origin}/p/${e.slug}`, lastModified: new Date(e.updatedAt) })),
  ];
}
