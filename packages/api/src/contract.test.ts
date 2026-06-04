import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeCanonical } from '@mcp-definer/schemas';
import { applyCuration, emptyCuration, mapIrToManifest, parseSpec } from '@mcp-definer/generator';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as T;
}

function authHeaders(apiKey = 'contract-test-key') {
  return { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
}

describe('contract: discovery index shape', () => {
  it('GET /v1/index matches fixtures/registry/index-v1.json', async () => {
    const config = loadConfig({
      MOCK_MODE: 'true',
      MCP_DEFINER_API_KEY: 'contract-test-key',
      REGISTRY_STORE: 'memory',
    });
    const { app } = await createApp(config);

    const res = await app.request('http://localhost/v1/index');
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      indexVersion: string;
      entries: Array<{
        org: string;
        slug: string;
        toolNames: string[];
        toolCount: number;
        mcpProtocolVersion: string;
      }>;
    };
    const fixture = loadFixture<typeof body>('fixtures/registry/index-v1.json');

    expect(body.indexVersion).toBe(fixture.indexVersion);
    expect(body.entries[0].org).toBe(fixture.entries[0].org);
    expect(body.entries[0].slug).toBe(fixture.entries[0].slug);
    expect(body.entries[0].toolNames).toEqual(fixture.entries[0].toolNames);
    expect(body.entries[0].toolCount).toBe(fixture.entries[0].toolCount);
    expect(body.entries[0].mcpProtocolVersion).toBe(fixture.entries[0].mcpProtocolVersion);
  });
});

describe('contract: credential write-only', () => {
  it('POST secret → GET binding has hasSecret, no secret field', async () => {
    const config = loadConfig({
      MOCK_MODE: 'true',
      MCP_DEFINER_API_KEY: 'contract-test-key',
      REGISTRY_STORE: 'memory',
    });
    const { app, ctx } = await createApp(config);

    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
    const manifest = (await ctx.registryStore.getManifestById(version!.manifestId))!.content;
    const secret = 'contract-secret-must-not-leak-88';

    await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret,
      }),
    });

    const getRes = await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      headers: authHeaders(),
    });
    const body = (await getRes.json()) as {
      binding: { secret?: string; hasSecret: boolean };
    };
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain(secret);
    expect(body.binding.secret).toBeUndefined();
    expect(body.binding.hasSecret).toBe(true);
  });
});

describe('contract: generator determinism (NFR-06)', () => {
  it('same petstore input yields byte-identical manifest', async () => {
    const petstoreSpec = join(repoRoot, 'fixtures/openapi/petstore.yaml');
    const mapOptions = {
      name: 'petstore',
      displayName: 'Petstore API',
      description: 'MCP for the Petstore API',
      authBindingId: 'cb_petstore_apikey',
      securityScheme: 'api_key',
    };

    async function compile() {
      const { ir } = await parseSpec({ kind: 'file', path: petstoreSpec });
      const draft = mapIrToManifest(ir, mapOptions);
      return applyCuration(draft, emptyCuration(), ir);
    }

    const first = serializeCanonical(await compile());
    const second = serializeCanonical(await compile());
    expect(first).toBe(second);
  });
});
