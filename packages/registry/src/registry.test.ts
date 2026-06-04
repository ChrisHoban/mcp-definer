import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { secretEnvVarName } from '@mcp-definer/auth';
import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import {
  buildIndex,
  buildInstallSnippet,
  createSeededRegistryStore,
  deprecateVersion,
  fetchManifest,
  getRegistryDetail,
  InMemoryRegistryStore,
  publishVersion,
  RegistryError,
  searchCatalog,
  seedPetstoreFixture,
  updateDraftManifest,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function loadPetstoreIndexManifest(): Manifest {
  const full = JSON.parse(
    readFileSync(join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json'), 'utf8'),
  ) as Manifest;
  return {
    ...full,
    tools: full.tools
      .filter((tool) => ['getPetById', 'findPetsByStatus'].includes(tool.name))
      .map((tool) => (tool.name === 'findPetsByStatus' ? { ...tool, name: 'listPets' } : tool)),
  };
}

describe('registry: publish flow', () => {
  it('validates, publishes, and emits audit event', async () => {
    const store = new InMemoryRegistryStore();
    await store.ensureOrg('acme');
    const manifest = loadPetstoreIndexManifest();

    await store.createMcp({
      org: 'acme',
      slug: 'petstore',
      name: 'Petstore API',
      description: 'MCP for the Petstore API',
      visibility: 'public',
      ownerId: 'user-1',
      tags: ['pets', 'demo'],
      manifest,
      version: '1.0.0',
    });

    const ctx = { store, baseUrl: '/v1' };
    const result = await publishVersion(ctx, {
      org: 'acme',
      slug: 'petstore',
      version: '1.0.0',
      channel: 'stable',
      actorId: 'user-1',
    });

    expect(result.version).toBe('1.0.0');
    expect(result.manifestUrl).toBe('/v1/registry/acme/petstore/versions/1.0.0/manifest');

    const events = await store.listAuditEvents();
    expect(events.some((e) => e.action === 'mcp.version.publish')).toBe(true);
  });

  it('rejects publish when manifest is invalid', async () => {
    const store = new InMemoryRegistryStore();
    await store.ensureOrg('acme');
    const manifest = loadPetstoreIndexManifest();
    const invalid = { ...manifest } as unknown as Manifest;
    delete (invalid as unknown as Record<string, unknown>).auth;

    await store.createMcp({
      org: 'acme',
      slug: 'bad',
      name: 'Bad MCP',
      description: 'Invalid',
      visibility: 'private',
      ownerId: 'user-1',
      manifest: invalid,
      version: '0.1.0',
    });

    const ctx = { store, baseUrl: '/v1' };
    await expect(
      publishVersion(ctx, {
        org: 'acme',
        slug: 'bad',
        version: '0.1.0',
        channel: 'stable',
        actorId: 'user-1',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('returns 409 when mutating a published version', async () => {
    const store = await createSeededRegistryStore();
    const ctx = { store, baseUrl: '/v1' };

    await expect(
      updateDraftManifest(ctx, 'acme', 'petstore', '1.0.0', loadPetstoreIndexManifest()),
    ).rejects.toMatchObject({ code: 'IMMUTABLE', statusCode: 409 });
  });

  it('emits audit event on deprecate', async () => {
    const store = await createSeededRegistryStore();
    const ctx = { store, baseUrl: '/v1' };

    await deprecateVersion(ctx, {
      org: 'acme',
      slug: 'petstore',
      version: '1.0.0',
      actorId: 'user-fixture',
    });

    const events = await store.listAuditEvents();
    expect(events.some((e) => e.action === 'mcp.version.deprecate')).toBe(true);
  });
  it('persists source spec, curation, and author state for draft versions', async () => {
    const store = new InMemoryRegistryStore();
    await store.ensureOrg('acme');
    const manifest = loadPetstoreIndexManifest();
    const curation = {
      curationVersion: '1.0' as const,
      toolDescriptions: { getPetById: 'Fetch a pet by id.' },
    };

    const { version } = await store.createMcp({
      org: 'acme',
      slug: 'persist-test',
      name: 'Persist Test',
      description: 'test',
      visibility: 'private',
      ownerId: 'user-1',
      manifest,
      version: '0.1.0',
      sourceSpec: {
        specText: 'openapi: 3.0.0\ninfo:\n  title: Test\npaths: {}',
        specType: 'openapi3',
      },
      curation,
      authorState: { wizardStep: 'curate', parseWarnings: [{ code: 'W1', message: 'warn' }] },
    });

    const authoring = await store.getVersionAuthoringData(version.id);
    expect(authoring.sourceSpec?.contentText).toContain('openapi: 3.0.0');
    expect(authoring.curation?.toolDescriptions?.getPetById).toBe('Fetch a pet by id.');
    expect(authoring.authorState.wizardStep).toBe('curate');
  });
});

describe('registry: buildIndex matches fixture', () => {
  it('produces discovery index v1 matching fixtures/registry/index-v1.json', async () => {
    const fixture = JSON.parse(
      readFileSync(join(repoRoot, 'fixtures/registry/index-v1.json'), 'utf8'),
    );

    const store = await createSeededRegistryStore();
    const ctx = { store, baseUrl: '/v1' };
    const index = await buildIndex(ctx, { generatedAt: fixture.generatedAt });

    expect(index).toEqual(fixture);
  });
});

describe('registry: buildInstallSnippet', () => {
  it('produces ADR-008 Cursor stdio config with manifest URL and secret env placeholder', () => {
    const manifest = loadPetstoreIndexManifest();
    const snippet = buildInstallSnippet(
      { org: 'acme', slug: 'petstore' },
      '1.0.0',
      manifest,
      { registryBaseUrl: 'https://registry.example.com/v1' },
    );

    expect(snippet.command).toBe('npx');
    expect(snippet.args).toEqual([
      '-y',
      '@mcp-definer/runtime',
      '--manifest',
      'https://registry.example.com/v1/registry/acme/petstore/versions/1.0.0/manifest',
    ]);
    expect(snippet.env).toEqual({
      [secretEnvVarName('cb_petstore_apikey')]: '<user-supplied at install>',
    });
  });
});

describe('registry: catalog and manifest', () => {
  it('searchCatalog filters by capability and tag', async () => {
    const store = await createSeededRegistryStore();
    const ctx = { store, baseUrl: '/v1' };

    const byTool = await searchCatalog(ctx, { capability: 'getPetById' });
    expect(byTool.entries).toHaveLength(1);

    const byTag = await searchCatalog(ctx, { tags: ['demo'] });
    expect(byTag.entries).toHaveLength(1);

    const miss = await searchCatalog(ctx, { query: 'nonexistent' });
    expect(miss.entries).toHaveLength(0);
  });

  it('getRegistryDetail and fetchManifest serve published data', async () => {
    const store = await createSeededRegistryStore();
    const ctx = { store, baseUrl: '/v1' };

    const detail = await getRegistryDetail(ctx, 'acme', 'petstore');
    expect(detail.latestVersion).toBe('1.0.0');
    expect(detail.installTargets.length).toBeGreaterThan(0);

    const manifest = await fetchManifest(ctx, 'acme', 'petstore', '1.0.0');
    expect(manifest.name).toBe('petstore');
    expect(manifest.auth.bindingId).toBe('cb_petstore_apikey');
  });

  it('fetchManifest rejects unpublished version', async () => {
    const store = new InMemoryRegistryStore();
    await store.ensureOrg('acme');
    await store.createMcp({
      org: 'acme',
      slug: 'draft-only',
      name: 'Draft',
      description: 'Draft',
      visibility: 'private',
      ownerId: 'user-1',
      manifest: loadPetstoreIndexManifest(),
      version: '0.0.1',
    });

    const ctx = { store, baseUrl: '/v1' };
    await expect(fetchManifest(ctx, 'acme', 'draft-only', '0.0.1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('registry: seedPetstoreFixture', () => {
  it('seeds store idempotently per test instance', async () => {
    const store = new InMemoryRegistryStore();
    await seedPetstoreFixture(store);
    const ctx = { store, baseUrl: '/v1' };
    const index = await buildIndex(ctx);
    expect(index.entries).toHaveLength(1);
  });
});

describe('registry: errors', () => {
  it('RegistryError carries HTTP status codes', () => {
    expect(new RegistryError('NOT_FOUND', 'missing').statusCode).toBe(404);
    expect(new RegistryError('IMMUTABLE', 'frozen').statusCode).toBe(409);
  });
});
