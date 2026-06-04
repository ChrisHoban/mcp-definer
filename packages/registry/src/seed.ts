import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';

import { InMemoryRegistryStore } from './in-memory-store.js';
import type { ControlPlaneRegistryStore } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function loadManifest(relativePath: string): Manifest {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as Manifest;
}

/** Seed store with petstore fixture matching fixtures/registry/index-v1.json. */
export async function seedPetstoreFixture(
  store: ControlPlaneRegistryStore,
  actorId = 'user_dev',
): Promise<void> {
  const fullManifest = loadManifest('fixtures/manifests/petstore-apikey.manifest.json');
  const indexManifest: Manifest = {
    ...fullManifest,
    tools: fullManifest.tools
      .filter((tool) => ['getPetById', 'findPetsByStatus'].includes(tool.name))
      .map((tool) =>
        tool.name === 'findPetsByStatus' ? { ...tool, name: 'listPets' } : tool,
      ),
  };

  const { mcp, version } = await store.createMcp({
    org: 'acme',
    slug: 'petstore',
    name: 'Petstore API',
    description: 'MCP for the Petstore API',
    visibility: 'public',
    ownerId: actorId,
    tags: ['pets', 'demo'],
    manifest: indexManifest,
    version: '1.0.0',
  });

  await store.publishVersion(version.id, 'stable', actorId);
  await store.emitAuditEvent({
    orgId: mcp.orgId,
    actorId,
    action: 'mcp.seed',
    targetType: 'mcp',
    targetId: mcp.id,
    metadata: { org: 'acme', slug: 'petstore' },
  });
}

export async function createSeededRegistryStore(): Promise<InMemoryRegistryStore> {
  const store = new InMemoryRegistryStore();
  await store.ensureOrg('acme', 'Acme Corp');
  await seedPetstoreFixture(store);
  return store;
}
