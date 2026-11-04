/**
 * Prépare le projet : secrets aléatoires, base de données et contenu de départ.
 * Peut être relancé sans risque : rien d'existant n'est écrasé.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = '.env.local';

if (!existsSync(ENV_FILE)) {
  const secret = () => randomBytes(32).toString('base64');
  const content = [
    'DATABASE_URL=file:./data/site.db',
    'DATABASE_AUTH_TOKEN=',
    'APP_ORIGIN=http://localhost:3000',
    `SESSION_SECRET=${secret()}`,
    `PASSWORD_PEPPER=${secret()}`,
    `ENCRYPTION_KEY=${secret()}`,
    'TRUSTED_IP_HEADER=',
    '',
  ].join('\n');
  writeFileSync(ENV_FILE, content, { mode: 0o600 });
  console.log('Secrets générés dans .env.local');
}

for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m?.[1] && m[2] !== undefined) process.env[m[1]] ??= m[2];
}

mkdirSync('data', { recursive: true });

async function main() {
  const { migrate } = await import('../src/db/migrate');
  const { seed } = await import('../src/db/seed');
  const applied = await migrate();
  console.log(applied.length ? `Migrations appliquées : ${applied.join(', ')}` : 'Base déjà à jour.');
  console.log((await seed()) ? 'Contenu de départ importé.' : 'Du contenu existe déjà : rien n’a été importé.');
  console.log('Créez ensuite le compte propriétaire : npm run admin:create');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
