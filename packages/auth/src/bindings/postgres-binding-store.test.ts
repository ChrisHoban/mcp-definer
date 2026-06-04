import { createPool, resolveDatabaseUrl, runMigrations, validateDatabase } from '@mcp-definer/db';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

import { EnvSecretStore } from '../secrets/env-secret-store.js';
import { envSecretRef } from '../secrets/env-ref.js';
import { PostgresBindingStore } from './postgres-binding-store.js';

const DATABASE_URL = process.env.DATABASE_URL ?? resolveDatabaseUrl();

const dbAvailable = process.env.SKIP_DB_TESTS !== 'true';

describe.skipIf(!dbAvailable)('PostgresBindingStore', () => {
  let store: PostgresBindingStore;
  let mcpId: string;

  beforeAll(async () => {
    await runMigrations(DATABASE_URL);
    const pool = createPool(DATABASE_URL);
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
    const orgId = org.rows[0].id as string;

    const user = await pool.query(
      `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id`,
      [`binding-test-${Date.now()}@test.local`, 'Binding Test'],
    );
    const userId = user.rows[0].id as string;

    const mcp = await pool.query(
      `INSERT INTO mcps (org_id, slug, name, owner_id, visibility, status)
       VALUES ($1, $2, $3, $4, 'private', 'draft')
       RETURNING id`,
      [orgId, `binding-mcp-${Date.now()}`, 'Binding MCP', userId],
    );
    mcpId = mcp.rows[0].id as string;

    store = new PostgresBindingStore(pool, new EnvSecretStore());
  });

  afterAll(async () => {
    // pool lifecycle owned by test process exit
  });

  it('persists binding metadata with env secretRef', async () => {
    const bindingId = `cb_pg_${Date.now()}`;
    const created = await store.create(
      { id: bindingId, mcpId, authType: 'apiKey', config: { in: 'header', name: 'X-API-Key' } },
      'test-secret-value',
    );

    expect(created.secretRef).toBe(envSecretRef(bindingId));
    expect(created.hasSecret).toBe(true);
    expect(created).not.toHaveProperty('secret');

    const loaded = await store.get(bindingId);
    expect(loaded?.hasSecret).toBe(true);
  });
});
