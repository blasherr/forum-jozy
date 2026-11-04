import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { db } from './client';

/** Applique les fichiers de src/db/migrations dans l'ordre, une seule fois chacun. */
export async function migrate(): Promise<string[]> {
  const client = db.$client;
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`,
  );
  const dir = path.join(process.cwd(), 'src/db/migrations');
  const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const applied: string[] = [];
  for (const file of files) {
    const done = await client.execute({ sql: 'SELECT 1 FROM _migrations WHERE name = ?', args: [file] });
    if (done.rows.length > 0) continue;
    await client.executeMultiple(readFileSync(path.join(dir, file), 'utf8'));
    await client.execute({ sql: 'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', args: [file, Date.now()] });
    applied.push(file);
  }
  return applied;
}
