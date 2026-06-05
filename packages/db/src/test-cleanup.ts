import type pg from 'pg';

type DbClient = pg.Pool | pg.PoolClient;

export interface TestDbFixtureIds {
  bindingId?: string;
  mcpId?: string;
  userId?: string;
  orgId?: string;
}

export async function deleteTestCredentialBinding(
  client: DbClient,
  bindingId: string,
): Promise<void> {
  await client.query('DELETE FROM credential_bindings WHERE id = $1', [bindingId]);
}

export async function deleteTestMcp(client: DbClient, mcpId: string): Promise<void> {
  await client.query('DELETE FROM mcps WHERE id = $1', [mcpId]);
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
