import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { audit } from '@/lib/security/audit';
import { normalizeEmail } from '@/lib/security/auth';
import { adminRoute } from '@/lib/security/guard';
import { checkPassword, hashPassword } from '@/lib/security/password';
import { HttpError, json, readJson } from '@/lib/security/request';

const schema = z
  .object({
    email: z.string().trim().email('E-mail invalide.').max(254),
    name: z.string().trim().min(1, 'Nom requis.').max(80),
    role: z.enum(['admin', 'editor']),
    password: z.string().min(1).max(256),
  })
  .strict();

/** Le compte créé doit changer son mot de passe à la première connexion. Seul le propriétaire crée des comptes. */
export const POST = adminRoute({ role: 'owner', sudo: true }, async ({ req, user }) => {
  const input = await readJson(req, schema, 2048);
  const email = normalizeEmail(input.email);
  const problem = checkPassword(input.password, [email, input.name]);
  if (problem) throw new HttpError(422, 'weak_password', problem);
  const exists = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (exists[0]) throw new HttpError(409, 'email_taken', 'Cet e-mail est déjà utilisé.');
  const id = randomUUID();
  await db.insert(users).values({
    id,
    email,
    name: input.name,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    mustChangePassword: true,
  });
  await audit({ action: 'user.create', req, user, target: email, meta: { role: input.role } });
  return json({ ok: true, id }, 201);
});
