import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPool, resolveDatabaseUrl, runMigrations, validateDatabase } from '@mcp-definer/db';
import type { Manifest } from '@mcp-definer/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createPostgresRegistryStore, type PostgresRegistryStore } from './postgres-store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const databaseUrl = process.env.DATABASE_URL ?? resolveDatabaseUrl();

async function canConnect(): Promise<boolean> {
  const pool = createPool(databaseUrl);
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
let store: PostgresRegistryStore;

describe.skipIf(!dbAvailable)('PostgresRegistryStore', () => {
  beforeAll(async () => {
    await runMigrations(databaseUrl);
    const pool = createPool(databaseUrl);
    const health = await validateDatabase(pool);
    expect(health.ok).toBe(true);

    store = await createPostgresRegistryStore({
      pool,
      defaultOrgSlug: 'acme',
      defaultUserStubId: 'user_dev',
    });
  }, 30_000);

  afterAll(async () => {
    await store?.close();
  });

  it('persists source spec, curation, and author state', async () => {
    const manifest = JSON.parse(
      readFileSync(join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json'), 'utf8'),
    ) as Manifest;

    const slug = `pg-persist-${Date.now()}`;
    const user = await store.ensureUser('user_dev');
    const { version } = await store.createMcp({
      org: 'acme',
      slug,
      name: 'PG Persist',
      description: 'test',
      visibility: 'private',
      ownerId: user.id,
      manifest,
      version: '0.1.0',
      sourceSpec: {
        specText: 'openapi: 3.0.0\ninfo:\n  title: PG\npaths: {}',
        specType: 'openapi3',
      },
      curation: {
        curationVersion: '1.0',
        toolDescriptions: { getPetById: 'Fetch pet from postgres test.' },
      },
      authorState: { wizardStep: 'curate', parseWarnings: [{ code: 'W1', message: 'warn' }] },
    });

    const authoring = await store.getVersionAuthoringData(version.id);
    expect(authoring.sourceSpec?.contentText).toContain('openapi: 3.0.0');
    expect(authoring.curation?.toolDescriptions?.getPetById).toBe('Fetch pet from postgres test.');
    expect(authoring.authorState.wizardStep).toBe('curate');
  });
});
