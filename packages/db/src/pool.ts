import pg from 'pg';

import { resolveDatabaseUrl } from './env.js';

export type DbPool = pg.Pool;

export interface DatabaseHealth {
  ok: boolean;
  latencyMs: number;
  postgresVersion?: string;
  migrationCount?: number;
  error?: string;
}

const REQUIRED_TABLES = [
  'organizations',
  'users',
  'mcps',
  'manifests',
  'source_specs',
  'mcp_versions',
  'curation_profiles',
  'tools',
  'schema_migrations',
] as const;

export function createPool(connectionString?: string): DbPool {
  return new pg.Pool({
    connectionString: connectionString ?? resolveDatabaseUrl(),
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/** Verify connectivity and that core schema objects exist after migrations. */
export async function validateDatabase(pool: DbPool): Promise<DatabaseHealth> {
  const started = Date.now();
  try {
    const versionResult = await pool.query<{ version: string }>('SELECT version()');
    const postgresVersion = versionResult.rows[0]?.version;

    for (const table of REQUIRED_TABLES) {
      const exists = await pool.query<{ regclass: string | null }>(
        'SELECT to_regclass($1) AS regclass',
        [`public.${table}`],
      );
      if (!exists.rows[0]?.regclass) {
        return {
          ok: false,
          latencyMs: Date.now() - started,
          postgresVersion,
          error: `Missing required table: ${table}. Run database migrations.`,
        };
      }
    }

    const migrations = await pool.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM schema_migrations',
    );

    return {
      ok: true,
      latencyMs: Date.now() - started,
      postgresVersion,
      migrationCount: Number(migrations.rows[0]?.count ?? 0),
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function closePool(pool: DbPool): Promise<void> {
  await pool.end();
}
