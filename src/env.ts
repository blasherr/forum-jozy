import 'server-only';
import { z } from 'zod';

const secret = z
  .string()
  .min(40, 'secret trop court')
  .refine((v) => Buffer.from(v, 'base64').length >= 32, 'au moins 32 octets aléatoires en base64');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).default('file:./data/site.db'),
  DATABASE_AUTH_TOKEN: z.string().optional(),
  APP_ORIGIN: z.string().url(),
  SESSION_SECRET: secret,
  PASSWORD_PEPPER: secret,
  ENCRYPTION_KEY: secret,
  TRUSTED_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]*$/i)
    .optional(),
  REQUIRE_2FA: z.enum(['true', 'false']).optional(),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // On ne journalise que le nom des variables : jamais leur valeur.
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Configuration invalide (${names}). Lancez "npm run setup" ou voir .env.example.`);
  }
  const e = parsed.data;
  const origin = new URL(e.APP_ORIGIN);
  if (e.NODE_ENV === 'production' && origin.protocol !== 'https:' && origin.hostname !== 'localhost') {
    throw new Error('APP_ORIGIN doit être en https en production.');
  }
  // Sans IP fiable, tous les visiteurs partagent un seul compteur : 6 essais bloqueraient un compte.
  if (e.NODE_ENV === 'production' && !e.TRUSTED_IP_HEADER) {
    throw new Error('TRUSTED_IP_HEADER est obligatoire en production (voir le README).');
  }
  return {
    ...e,
    APP_ORIGIN: origin.origin,
    isProd: e.NODE_ENV === 'production',
    require2fa: e.REQUIRE_2FA ? e.REQUIRE_2FA === 'true' : e.NODE_ENV === 'production',
  };
}

type Env = ReturnType<typeof load>;
let cached: Env | undefined;

/** Lecture paresseuse : `next build` n'a pas besoin des secrets. */
export const env: Env = new Proxy({} as Env, {
  get(_t, prop: string) {
    cached ??= load();
    return cached[prop as keyof Env];
  },
});
