/**
 * Réinitialise un accès perdu : nouveau mot de passe, 2FA retirée, toutes les sessions fermées.
 * Il n'y a volontairement aucun « mot de passe oublié » par e-mail sur le site : c'est une
 * surface d'attaque en moins. Seul quelqu'un qui a accès au serveur peut le faire.
 *
 * npm run admin:reset
 */
import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { loadEnv } from './load-env';

loadEnv();

async function main() {
  const { db } = await import('../src/db/client');
  const { rateLimits, sessions, users } = await import('../src/db/schema');
  const { hashPassword, checkPassword } = await import('../src/lib/security/password');

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await rl.question('E-mail du compte : ')).trim().toLowerCase();
  console.log('Le mot de passe apparaîtra à l’écran : videz le terminal ensuite.');
  const password = await rl.question('Nouveau mot de passe : ');
  rl.close();

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user) throw new Error('Compte introuvable.');
  const problem = checkPassword(password, [email, user.name]);
  if (problem) throw new Error(problem);

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      totpEnabled: false,
      totpSecret: null,
      totpLastStep: 0,
      recoveryCodes: [],
      disabled: false,
    })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  // Lève aussi tout blocage de connexion en cours : c'est le recours si le compte est saturé d'essais.
  await db.delete(rateLimits);
  console.log('Accès réinitialisé. La double authentification devra être réactivée.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
