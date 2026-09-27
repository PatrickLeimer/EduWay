/**
 * Creates the collections and indexes from master doc §9. Idempotent: safe to
 * run on every deploy. Run with `npm run db:setup` (needs MONGODB_URI in server/.env).
 */
import { pathToFileURL } from 'node:url';

import type { Db } from 'mongodb';

import { loadConfig } from '../config';

import { closeDb, connectDb } from './client';
import { COLLECTIONS, INDEXES } from './collections';

export async function ensureCollectionsAndIndexes(
  db: Db,
  log: (msg: string) => void = console.log,
) {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name),
  );

  for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
    if (!existing.has(name)) {
      await db.createCollection(name);
      log(`created collection ${name}`);
    }
    const indexes = INDEXES[key];
    if (indexes.length > 0) {
      const created = await db.collection(name).createIndexes(indexes);
      log(`indexes on ${name}: ${created.join(', ')}`);
    }
  }
}

// CLI entry: only runs when executed directly, not when imported.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const config = loadConfig();
  if (!config.MONGODB_URI) {
    console.error('MONGODB_URI is not set. Add it to server/.env (see server/.env.example).');
    process.exit(1);
  }
  try {
    const db = await connectDb(config.MONGODB_URI, config.MONGODB_DB);
    await ensureCollectionsAndIndexes(db);
    console.log(`db:setup done on database "${config.MONGODB_DB}"`);
  } catch (e) {
    console.error('db:setup failed:', e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
}
