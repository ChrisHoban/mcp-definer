import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DISCOVERY_INDEX_QUERY, REFRESH_DISCOVERY_INDEX_SQL } from './index.js';
import { resolveDatabaseUrl } from './env.js';
import { runMigrations } from './migrate.js';

const databaseUrl = process.env.DATABASE_URL ?? resolveDatabaseUrl();

async function canConnect(): Promise<boolean> {
  const client = new pg.Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.end();
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = await canConnect();
const pool = dbAvailable ? new pg.Pool({ connectionString: databaseUrl }) : null;

describe.skipIf(!dbAvailable)('db: migrations and immutability', () => {
  beforeAll(async () => {
    await runMigrations(databaseUrl);
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('discovery_index view exists and is queryable', async () => {
    const result = await pool!.query(DISCOVERY_INDEX_QUERY);
    expect(Array.isArray(result.rows)).toBe(true);
  });

  it('rejects mutation of published mcp_version', async () => {
    const client = await pool!.connect();
    try {
      await client.query('BEGIN');

      const org = await client.query(
        `INSERT INTO organizations (slug, name) VALUES ('test-org', 'Test Org') RETURNING id`,
      );
      const user = await client.query(
        `INSERT INTO users (email, display_name) VALUES ('test@example.com', 'Test User') RETURNING id`,
      );
      const mcp = await client.query(
        `INSERT INTO mcps (org_id, slug, name, owner_id, visibility)
         VALUES ($1, 'petstore', 'Petstore', $2, 'public') RETURNING id`,
        [org.rows[0].id, user.rows[0].id],
      );
      const manifest = await client.query(
        `INSERT INTO manifests (content, content_hash)
         VALUES ('{"name":"petstore"}'::jsonb, 'hash-test-immutability') RETURNING id`,
      );
      const version = await client.query(
        `INSERT INTO mcp_versions (mcp_id, version, channel, manifest_id, published_at, published_by)
         VALUES ($1, '1.0.0', 'stable', $2, now(), $3) RETURNING id`,
        [mcp.rows[0].id, manifest.rows[0].id, user.rows[0].id],
      );

      await expect(
        client.query(`UPDATE mcp_versions SET version = '1.0.1' WHERE id = $1`, [
          version.rows[0].id,
        ]),
      ).rejects.toThrow(/immutable/i);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  it('refresh_discovery_index function is callable', async () => {
    await pool!.query(REFRESH_DISCOVERY_INDEX_SQL);
  });
});
