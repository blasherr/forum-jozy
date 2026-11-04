import { z } from 'zod';
import type { RichDoc } from '@/lib/richtext/types';
import { safeHref } from '@/lib/richtext/url';
import { RichTextError, sanitizeDoc } from '@/lib/richtext/validate';

/** Tous les objets sont `.strict()` : un champ non prévu fait échouer la requête (anti mass-assignment). */
const text = (max = 200) => z.string().trim().max(max);

export const hrefSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => safeHref(v) !== null, 'Lien refusé : utilisez https://, mailto: ou un chemin interne comme /reglement.');

export const optionalHref = z.union([z.literal(''), hrefSchema]);

export const richDocSchema = z.unknown().transform((value, ctx): RichDoc => {
  try {
    return sanitizeDoc(value);
  } catch (error) {
    ctx.addIssue({
      code: 'custom',
      message: error instanceof RichTextError ? `Contenu refusé : ${error.message}` : 'Contenu refusé.',
    });
    return z.NEVER;
  }
});

const mediaId = z.string().uuid().nullable();

export const SEALS = ['red', 'black', 'gold', 'green', 'blue'] as const;

const button = z
  .object({
    label: text(60).min(1, 'Un bouton doit avoir un libellé.'),
    href: hrefSchema,
    variant: z.enum(['primary', 'secondary', 'brass']),
  })
  .strict();

const header = z
  .object({
    kicker: text(120),
    title: text(120).min(1, 'Titre requis.'),
    subtitle: text(500),
    seoDescription: text(300),
    image: mediaId,
  })
  .strict();

export const siteSchema = z
  .object({
    name: text(80).min(1),
    shortName: text(30).min(1),
    tagline: text(160),
    description: text(300),
    logoMediaId: mediaId,
    loader: z
      .object({
        enabled: z.boolean(),
        images: z.array(z.string().uuid()).max(8),
        tips: z.array(text(200)).max(24),
      })
      .strict(),
    server: z
      .object({
        connectLabel: text(60),
        connectCommand: text(200),
        teamspeakLabel: text(60),
        teamspeakAddress: text(200),
      })
      .strict(),
    footer: z
      .object({
        motto: text(200),
        legal: text(400),
        links: z.array(z.object({ label: text(60).min(1), href: hrefSchema }).strict()).max(12),
      })
      .strict(),
  })
  .strict();

export const HOME_SECTIONS = ['intro', 'board', 'pillars', 'gallery', 'chronicle', 'join', 'gazette', 'vote'] as const;

export const homeSchema = z
  .object({
    order: z.array(z.enum(HOME_SECTIONS)).max(HOME_SECTIONS.length),
    hero: z
      .object({
        kicker: text(120),
        title: text(80).min(1),
        subtitle: text(500),
        scene: z.enum(['video', 'photos', 'bayou', 'mountains']),
        slides: z.array(z.string().uuid()).max(8),
        buttons: z.array(button).max(3),
      })
      .strict(),
    intro: z.object({ kicker: text(120), title: text(160), body: richDocSchema }).strict(),
    board: z.object({ kicker: text(120), title: text(160), intro: text(400) }).strict(),
    pillars: z
      .object({
        kicker: text(120),
        title: text(160),
        items: z
          .array(
            z
              .object({
                title: text(80).min(1),
                text: text(500),
                href: optionalHref,
                seal: z.enum(SEALS),
              })
              .strict(),
          )
          .max(9),
      })
      .strict(),
    gallery: z
      .object({
        kicker: text(120),
        title: text(160),
        items: z
          .array(z.object({ mediaId: z.string().uuid(), caption: text(160) }).strict())
          .max(12),
      })
      .strict(),
    chronicle: z
      .object({
        kicker: text(120),
        title: text(160),
        image: mediaId,
        items: z
          .array(z.object({ year: text(20).min(1), title: text(120).min(1), text: text(600) }).strict())
          .max(24),
      })
      .strict(),
    join: z
      .object({
        kicker: text(120),
        title: text(160),
        steps: z
          .array(
            z
              .object({
                title: text(80).min(1),
                text: text(400),
                href: optionalHref,
                linkLabel: text(60),
              })
              .strict(),
          )
          .max(6),
      })
      .strict(),
    gazette: z
      .object({ kicker: text(120), title: text(160), count: z.number().int().min(1).max(6) })
      .strict(),
    vote: z
      .object({
        kicker: text(120),
        title: text(120),
        text: text(500),
        buttonLabel: text(60),
        href: hrefSchema,
        note: text(200),
        image: mediaId,
      })
      .strict(),
  })
  .strict();

export const pagesSchema = z
  .object({
    histoire: header,
    reglement: header,
    guide: header,
    patchnotes: header,
    discord: header,
    connexion: header,
  })
  .strict();

export const discordSchema = z
  .object({
    note: text(500),
    cards: z
      .array(
        z
          .object({
            title: text(80).min(1),
            description: text(300),
            href: hrefSchema,
            buttonLabel: text(60).min(1),
            seal: z.enum(SEALS),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide.');

export const FONT_OPTIONS = {
  display: ['rye', 'sancreek', 'ewert', 'smokum', 'holtwood', 'playfair'],
  heading: ['playfair', 'fell', 'caslon', 'rye', 'holtwood'],
  body: ['fell', 'caslon', 'oldstandard', 'garamond'],
} as const;

export const themeSchema = z
  .object({
    colors: z
      .object({
        blood: hex,
        gold: hex,
        ink: hex,
        paper: hex,
        night: hex,
      })
      .strict(),
    fonts: z
      .object({
        display: z.enum(FONT_OPTIONS.display),
        heading: z.enum(FONT_OPTIONS.heading),
        body: z.enum(FONT_OPTIONS.body),
      })
      .strict(),
    paper: z.enum(['paper', 'paper-light', 'paper-aged']),
    dust: z.boolean(),
    backgroundMediaId: mediaId,
  })
  .strict();

export const settingSchemas = {
  site: siteSchema,
  home: homeSchema,
  pages: pagesSchema,
  discord: discordSchema,
  theme: themeSchema,
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SiteSettings = z.output<typeof siteSchema>;
export type HomeSettings = z.output<typeof homeSchema>;
export type PagesSettings = z.output<typeof pagesSchema>;
export type DiscordSettings = z.output<typeof discordSchema>;
export type ThemeSettings = z.output<typeof themeSchema>;
export interface SettingsMap {
  site: SiteSettings;
  home: HomeSettings;
  pages: PagesSettings;
  discord: DiscordSettings;
  theme: ThemeSettings;
}

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Identifiant d’URL requis.')
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lettres minuscules, chiffres et tirets uniquement.');

export const entryInputSchema = z
  .object({
    title: text(160).min(1, 'Titre requis.'),
    slug: slugSchema,
    summary: text(500),
    body: richDocSchema,
    meta: z
      .object({
        category: text(80).optional(),
        author: text(80).optional(),
        version: text(40).optional(),
      })
      .strict(),
    status: z.enum(['draft', 'published']),
    publishedAt: z.number().int().positive().max(32503680000000).nullable(),
    note: text(200).optional(),
  })
  .strict();

export type EntryInput = z.output<typeof entryInputSchema>;

export const navInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            label: text(40).min(1, 'Libellé requis.'),
            href: hrefSchema,
            visible: z.boolean(),
            newTab: z.boolean(),
          })
          .strict(),
      )
      .max(16),
  })
  .strict();
