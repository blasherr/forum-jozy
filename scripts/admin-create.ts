/**
 * Crée le compte propriétaire. Il n'existe AUCUN compte par défaut ni inscription publique :
 * c'est le seul moyen de créer le premier accès, et il exige un accès au serveur.
 *
 * Interactif :      npm run admin:create
 * Automatisé :      ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run admin:create
 */
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { loadEnv } from './load-env';

loadEnv();

async function main() {
  const { db } = await import('../src/db/client');
  const { users } = await import('../src/db/schema');
  const { hashPassword, checkPassword } = await import('../src/lib/security/password');

  let email = process.env.ADMIN_EMAIL ?? '';
  let password = process.env.ADMIN_PASSWORD ?? '';
  let name = process.env.ADMIN_NAME ?? 'Propriétaire';

  if (!email || !password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    email = (await rl.question('E-mail : ')).trim();
    name = (await rl.question('Nom affiché : ')).trim() || name;
    console.log('Le mot de passe apparaîtra à l’écran : videz le terminal ensuite.');
    password = await rl.question('Mot de passe (12 caractères minimum) : ');
    rl.close();
  }

  email = email.normalize('NFKC').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('E-mail invalide.');
  const problem = checkPassword(password, [email, name]);
  if (problem) throw new Error(problem);

  const found = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (found[0]) throw new Error('Ce compte existe déjà. Utilisez npm run admin:reset.');

  await db.insert(users).values({
    id: randomUUID(),
    email,
    name,
    role: 'owner',
    passwordHash: await hashPassword(password),
  });
  console.log(`Compte propriétaire créé : ${email}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
