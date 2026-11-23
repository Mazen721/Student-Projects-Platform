import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import pino from 'pino';
import { connectDb, disconnectDb } from '../config/db.js';

const logger = pino({ level: 'info' });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INDEXES_PATH = path.resolve(__dirname, '../core/search/atlasIndexes.json');

export async function loadAtlasIndexDefinitions(filePath = DEFAULT_INDEXES_PATH) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed?.indexes)) {
    throw new Error('atlasIndexes.json must define an "indexes" array');
  }
  return parsed.indexes;
}

async function ensureCollectionExists(db, name) {
  const existing = await db.listCollections({ name }).toArray();
  if (existing.length === 0) {
    await db.createCollection(name);
  }
}

export async function syncSearchIndexes(db, indexes) {
  const results = [];
  for (const entry of indexes) {
    await ensureCollectionExists(db, entry.collection);
    const col = db.collection(entry.collection);
    const existing = await col.listSearchIndexes(entry.name).toArray();

    if (existing.length > 0) {
      await col.updateSearchIndex(entry.name, entry.definition);
      results.push({
        collection: entry.collection,
        name: entry.name,
        action: 'updated',
        status: existing[0].status || 'PENDING',
      });
    } else {
      await col.createSearchIndex({ name: entry.name, definition: entry.definition });
      results.push({
        collection: entry.collection,
        name: entry.name,
        action: 'created',
        status: 'PENDING',
      });
    }
  }
  return results;
}

async function main() {
  await connectDb();
  try {
    const indexes = await loadAtlasIndexDefinitions();
    const results = await syncSearchIndexes(mongoose.connection.db, indexes);
    logger.info({ results }, 'Atlas Search indexes synced');
  } catch (err) {
    if (err?.code === 59 || err?.code === 31082 || /SearchNotEnabled|listSearchIndexes/i.test(err?.message || '')) {
      logger.error(
        { err: err.message },
        'Atlas Search commands are only supported on MongoDB Atlas clusters (use SEARCH_PROVIDER=text locally).'
      );
      process.exitCode = 1;
      return;
    }
    throw err;
  } finally {
    await disconnectDb();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    logger.error({ err }, 'sync-search-indexes failed');
    process.exit(1);
  });
}
