import { sql } from 'drizzle-orm';
import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch('subsec') * 1000)`;

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role', { enum: ['owner', 'admin', 'editor'] }).notNull().default('editor'),
    passwordHash: text('password_hash').notNull(),
    mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
    totpSecret: text('totp_secret'),
    totpEnabled: integer('totp_enabled', { mode: 'boolean' }).notNull().default(false),
    totpLastStep: integer('totp_last_step').notNull().default(0),
    recoveryCodes: text('recovery_codes', { mode: 'json' }).$type<string[]>().notNull().default([]),
    disabled: integer('disabled', { mode: 'boolean' }).notNull().default(false),
    lastLoginAt: integer('last_login_at'),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('users_email_idx').on(t.email)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mfaPassed: integer('mfa_passed', { mode: 'boolean' }).notNull().default(false),
    sudoUntil: integer('sudo_until').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
    lastSeenAt: integer('last_seen_at').notNull().default(now),
    idleExpiresAt: integer('idle_expires_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Une seule ligne : augmente à chaque modification, pour que les pages ouvertes se rafraîchissent. */
export const siteVersion = sqliteTable('site_version', {
  id: integer('id').primaryKey(),
  content: integer('content').notNull().default(0),
  theme: integer('theme').notNull().default(0),
});

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at').notNull(),
});

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    at: integer('at').notNull().default(now),
    userId: text('user_id'),
    userEmail: text('user_email'),
    action: text('action').notNull(),
    target: text('target'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>(),
  },
  (t) => [index('audit_at_idx').on(t.at)],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: integer('updated_at').notNull().default(now),
  updatedBy: text('updated_by'),
});

export const navItems = sqliteTable('nav_items', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  href: text('href').notNull(),
  position: integer('position').notNull().default(0),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
  newTab: integer('new_tab', { mode: 'boolean' }).notNull().default(false),
});

export const COLLECTIONS = ['rules', 'guide', 'patchnotes', 'lore', 'pages'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const entries = sqliteTable(
  'entries',
  {
    id: text('id').primaryKey(),
    collection: text('collection', { enum: COLLECTIONS }).notNull(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    body: text('body', { mode: 'json' }).notNull(),
    meta: text('meta', { mode: 'json' }).$type<Record<string, string>>().notNull().default({}),
    position: integer('position').notNull().default(0),
    status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
    publishedAt: integer('published_at'),
    createdAt: integer('created_at').notNull().default(now),
    updatedAt: integer('updated_at').notNull().default(now),
    updatedBy: text('updated_by'),
  },
  (t) => [
    uniqueIndex('entries_collection_slug_idx').on(t.collection, t.slug),
    index('entries_collection_idx').on(t.collection, t.status, t.position),
  ],
);

export const revisions = sqliteTable(
  'revisions',
  {
    id: text('id').primaryKey(),
    /** « entry:<id> » ou « setting:<clé> » */
    subject: text('subject').notNull(),
    snapshot: text('snapshot', { mode: 'json' }).notNull(),
    createdAt: integer('created_at').notNull().default(now),
    createdBy: text('created_by'),
    note: text('note'),
  },
  (t) => [index('revisions_subject_idx').on(t.subject, t.createdAt)],
);

export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  alt: text('alt').notNull().default(''),
  mime: text('mime').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  data: blob('data', { mode: 'buffer' }).notNull(),
  createdAt: integer('created_at').notNull().default(now),
  createdBy: text('created_by'),
});

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Media = typeof media.$inferSelect;
export type NavItem = typeof navItems.$inferSelect;
