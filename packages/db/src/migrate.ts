import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

import { resolveDatabaseUrl } from './env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../migrations');

/** Serializes concurrent migration runners (e.g. parallel Vitest files in CI). */
const MIGRATION_ADVISORY_LOCK_KEY = 0x6d63705f; // 'mcp_'

export { DEFAULT_DATABASE_URL, DEV_DATABASE_URL } from './env.js';

async function listMigrationFiles(): Promise<string[]> {
  const files = await readdir(migrationsDir);
  return files.filter((name) => name.endsWith('.sql')).sort();
}

async function ensureMigrationTable(client: pg.Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(client: pg.Client): Promise<Set<string>> {
  const result = await client.query<{ id: string }>('SELECT id FROM schema_migrations ORDER BY id');
  return new Set(result.rows.map((row) => row.id));
}

async function applyMigration(client: pg.Client, id: string, sql: string): Promise<void> {
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
    await client.query('COMMIT');
    console.log(`Applied migration: ${id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function runMigrations(connectionString?: string): Promise<void> {
  const resolved = connectionString ?? resolveDatabaseUrl();
  const client = new pg.Client({ connectionString: resolved });
  await client.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
    try {
      await ensureMigrationTable(client);
      const applied = await getAppliedMigrations(client);
      const files = await listMigrationFiles();

      for (const file of files) {
        if (applied.has(file)) {
          console.log(`Skipping migration (already applied): ${file}`);
          continue;
        }

        const sql = await readFile(join(migrationsDir, file), 'utf8');
        await applyMigration(client, file, sql);
      }

      console.log('Migrations complete.');
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}
