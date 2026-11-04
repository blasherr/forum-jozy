import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

type Db = LibSQLDatabase<typeof schema> & { $client: Client };

const store = globalThis as unknown as { __nfDb?: Db; __nfDbReady?: Promise<void> };

function open(): Db {
  const url = process.env.DATABASE_URL || 'file:./data/site.db';
  const client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    intMode: 'number',
  });
  const instance = drizzle(client, { schema }) as Db;
  if (url.startsWith('file:')) {
    // Durcissement du fichier local : effacement réel des lignes, clés étrangères actives.
    store.__nfDbReady = (async () => {
      await client.execute('PRAGMA journal_mode = WAL');
      await client.execute('PRAGMA busy_timeout = 5000');
      await client.execute('PRAGMA foreign_keys = ON');
      await client.execute('PRAGMA secure_delete = ON');
    })();
  }
  return instance;
}

/** Connexion unique par processus. Toutes les requêtes passent par des paramètres liés. */
export const db: Db = new Proxy({} as Db, {
  get(_t, prop) {
    store.__nfDb ??= open();
    const target = store.__nfDb as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(store.__nfDb) : value;
  },
});

export async function dbReady(): Promise<void> {
  store.__nfDb ??= open();
  await store.__nfDbReady;
}
