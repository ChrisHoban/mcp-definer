import {
  cleanupTestDbFixture,
  createPool,
  resolveDatabaseUrl,
  runMigrations,
  validateDatabase,
} from '@mcp-definer/db';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type pg from 'pg';

import { EnvSecretStore } from '../secrets/env-secret-store.js';
import { envSecretRef } from '../secrets/env-ref.js';
import { PostgresBindingStore } from './postgres-binding-store.js';

const DATABASE_URL = process.env.DATABASE_URL ?? resolveDatabaseUrl();

async function canConnect(): Promise<boolean> {
  const pool = createPool(DATABASE_URL);
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await pool.end();
  }
}

const dbAvailable = await canConnect();

describe.skipIf(!dbAvailable)('PostgresBindingStore', () => {
  let pool: pg.Pool;
  let store: PostgresBindingStore;
  const fixture: { orgId: string; userId: string; mcpId: string } = {
    orgId: '',
    userId: '',
    mcpId: '',
  };

  beforeAll(async () => {
    await runMigrations(DATABASE_URL);
    pool = createPool(DATABASE_URL);
    const health = await validateDatabase(pool);
    if (!health.ok) {
      await pool.end();
      throw new Error(health.error ?? 'database unavailable');
    }

    const org = await pool.query(
      `INSERT INTO organizations (slug, name) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [`test-org-${Date.now()}`, 'Test Org'],
    );
    fixture.orgId = org.rows[0].id as string;

    const user = await pool.query(
      `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id`,
      [`binding-test-${Date.now()}@test.local`, 'Binding Test'],
    );
    fixture.userId = user.rows[0].id as string;

    const mcp = await pool.query(
      `INSERT INTO mcps (org_id, slug, name, owner_id, visibility, status)
       VALUES ($1, $2, $3, $4, 'private', 'draft')
       RETURNING id`,
      [fixture.orgId, `binding-mcp-${Date.now()}`, 'Binding MCP', fixture.userId],
    );
    fixture.mcpId = mcp.rows[0].id as string;

    store = new PostgresBindingStore(pool, new EnvSecretStore());
  });

  afterAll(async () => {
    await cleanupTestDbFixture(pool, fixture);
    await pool.end();
  });

  it('persists binding metadata with env secretRef', async () => {
    const bindingId = `cb_pg_${Date.now()}`;
    const created = await store.create(
      { id: bindingId, mcpId: fixture.mcpId, authType: 'apiKey', config: { in: 'header', name: 'X-API-Key' } },
      'test-secret-value',
    );

    expect(created.secretRef).toBe(envSecretRef(bindingId));
    expect(created.hasSecret).toBe(true);
    expect(created).not.toHaveProperty('secret');

    const loaded = await store.get(bindingId);
    expect(loaded?.hasSecret).toBe(true);

    await store.delete(bindingId);
    expect(await store.get(bindingId)).toBeUndefined();
  });
});
