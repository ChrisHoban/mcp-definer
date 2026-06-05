import type pg from 'pg';

type DbClient = pg.Pool | pg.PoolClient;

export interface TestDbFixtureIds {
  bindingId?: string;
  mcpId?: string;
  userId?: string;
  orgId?: string;
}

async function withDbConnection<T>(
  client: DbClient,
  fn: (conn: pg.PoolClient) => Promise<T>,
): Promise<T> {
  if ('connect' in client) {
    const conn = await client.connect();
    try {
      return await fn(conn);
    } finally {
      conn.release();
    }
  }
  return fn(client);
}

const IMMUTABILITY_TRIGGERS = [
  'mcp_versions_immutability',
  'manifests_immutability',
  'curation_profiles_immutability',
] as const;

async function disableImmutabilityTriggers(conn: pg.PoolClient): Promise<void> {
  for (const trigger of IMMUTABILITY_TRIGGERS) {
    const table =
      trigger === 'mcp_versions_immutability'
        ? 'mcp_versions'
        : trigger === 'manifests_immutability'
          ? 'manifests'
          : 'curation_profiles';
    await conn.query(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
  }
}

async function enableImmutabilityTriggers(conn: pg.PoolClient): Promise<void> {
  for (const trigger of IMMUTABILITY_TRIGGERS) {
    const table =
      trigger === 'mcp_versions_immutability'
        ? 'mcp_versions'
        : trigger === 'manifests_immutability'
          ? 'manifests'
          : 'curation_profiles';
    await conn.query(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
  }
}

export async function deleteTestCredentialBinding(
  client: DbClient,
  bindingId: string,
): Promise<void> {
  await client.query('DELETE FROM credential_bindings WHERE id = $1', [bindingId]);
}

/** Force-delete an MCP and cascaded rows, bypassing published-version immutability triggers. */
export async function deleteTestMcp(client: DbClient, mcpId: string): Promise<void> {
  await withDbConnection(client, async (conn) => {
    await conn.query('BEGIN');
    try {
      await disableImmutabilityTriggers(conn);
      await conn.query('UPDATE mcps SET latest_version_id = NULL WHERE id = $1', [mcpId]);
      await conn.query('DELETE FROM mcps WHERE id = $1', [mcpId]);
      await enableImmutabilityTriggers(conn);
      await conn.query('COMMIT');
    } catch (error) {
      await conn.query('ROLLBACK');
      throw error;
    }
  });
}

export async function deleteTestUser(client: DbClient, userId: string): Promise<void> {
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
}

export async function deleteTestOrganization(client: DbClient, orgId: string): Promise<void> {
  await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);
}

/** Removes rows created for an isolated Postgres test fixture (child tables cascade from mcps). */
export async function cleanupTestDbFixture(client: DbClient, ids: TestDbFixtureIds): Promise<void> {
  if (ids.bindingId) {
    await deleteTestCredentialBinding(client, ids.bindingId);
  }
  if (ids.mcpId) {
    await deleteTestMcp(client, ids.mcpId);
  }
  if (ids.userId) {
    await deleteTestUser(client, ids.userId);
  }
  if (ids.orgId) {
    await deleteTestOrganization(client, ids.orgId);
  }
}
