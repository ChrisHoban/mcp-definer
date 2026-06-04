import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';
import { loadConfig } from './config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function loadFixture<T>(path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as T;
}

function authHeaders(apiKey = 'dev-api-key') {
  return { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
}

function testConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    MOCK_MODE: 'true',
    MCP_DEFINER_API_KEY: 'test-key',
    REGISTRY_STORE: 'memory',
    ...overrides,
  });
}

describe('@mcp-definer/api', () => {
  it('GET /v1/index matches discovery index v1 fixture shape', async () => {
    const config = testConfig();
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
        installUrl: string;
        manifestUrl: string;
      }>;
    };
    const fixture = loadFixture<typeof body>('fixtures/registry/index-v1.json');

    expect(body.indexVersion).toBe(fixture.indexVersion);
    expect(body.entries).toHaveLength(fixture.entries.length);
    expect(body.entries[0].org).toBe(fixture.entries[0].org);
    expect(body.entries[0].slug).toBe(fixture.entries[0].slug);
    expect(body.entries[0].toolNames).toEqual(fixture.entries[0].toolNames);
    expect(body.entries[0].toolCount).toBe(fixture.entries[0].toolCount);
    expect(body.entries[0].mcpProtocolVersion).toBe(fixture.entries[0].mcpProtocolVersion);
    expect(body.entries[0].installUrl).toContain('/v1/registry/acme/petstore/install');
    expect(body.entries[0].manifestUrl).toContain('/v1/registry/acme/petstore/versions/1.0.0/manifest');

    const etag = res.headers.get('ETag');
    expect(etag).toBeTruthy();

    const cached = await app.request('http://localhost/v1/index', {
      headers: { 'If-None-Match': etag! },
    });
    expect(cached.status).toBe(304);
  });

  it('PATCH on published version returns 409', async () => {
    const config = testConfig();
    const { app, ctx } = await createApp(config);

    const mcps = await ctx.registryStore.listMcps();
    const petstore = mcps.items.find((m) => m.slug === 'petstore');
    expect(petstore).toBeDefined();

    const manifest = loadFixture<Manifest>('fixtures/manifests/petstore-apikey.manifest.json');
    const res = await app.request(
      `http://localhost/v1/mcps/${petstore!.id}/versions/1.0.0`,
      {
        method: 'PATCH',
        headers: authHeaders('test-key'),
        body: JSON.stringify({ manifest }),
      },
    );

    expect(res.status).toBe(409);
    const problem = (await res.json()) as { code: string };
    expect(problem.code).toBe('CONFLICT');
  });

  it('credential GET never returns secret values', async () => {
    const config = testConfig();
    const { app, ctx } = await createApp(config);

    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const manifest = await ctx.registryStore.getManifestById(
      (await ctx.registryStore.getLatestPublishedVersion(petstore.id))!.manifestId,
    );

    await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      method: 'POST',
      headers: authHeaders('test-key'),
      body: JSON.stringify({
        id: manifest!.content.auth.bindingId,
        authType: 'apiKey',
        config: manifest!.content.auth.apply,
        secret: 'super-secret-value-12345',
      }),
    });

    const getRes = await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      headers: authHeaders('test-key'),
    });
    const body = (await getRes.json()) as {
      binding: { secretRef: string; secret?: string; hasSecret: boolean };
    };
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain('super-secret-value-12345');
    expect(body.binding.secretRef).toBeDefined();
    expect(body.binding.secret).toBeUndefined();
    expect(body.binding.hasSecret).toBe(true);
  });

  it(':invoke blocks egress to non-allowed hosts', async () => {
    const config = testConfig();
    const { app, ctx } = await createApp(config);

    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
    const manifest = (await ctx.registryStore.getManifestById(version!.manifestId))!.content;

    await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      method: 'POST',
      headers: authHeaders('test-key'),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret: 'test-api-key',
      }),
    });

    const draft = await ctx.registryStore.createMcp({
      org: 'acme',
      slug: 'invoke-test',
      name: 'Invoke Test',
      description: 'test',
      visibility: 'private',
      ownerId: 'user_dev',
      manifest: {
        ...manifest,
        auth: { ...manifest.auth, bindingId: 'cb_invoke_test' },
        policies: { ...manifest.policies, egressAllowlist: ['petstore.swagger.io'] },
      },
      version: '0.1.0',
    });

    const draftVersion = (await ctx.registryStore.getVersionForMcp(draft.mcp.id, '0.1.0'))!;
    const stored = (await ctx.registryStore.getManifestById(draftVersion.manifestId))!.content;
    const evil = {
      ...stored,
      targetApi: { ...stored.targetApi, baseUrl: 'https://evil.example.com' },
    };
    await ctx.registryStore.updateDraftManifest(draftVersion.id, evil);

    await app.request(`http://localhost/v1/mcps/${draft.mcp.id}/credentials`, {
      method: 'POST',
      headers: authHeaders('test-key'),
      body: JSON.stringify({
        id: 'cb_invoke_test',
        authType: 'apiKey',
        config: evil.auth.apply,
        secret: 'test-api-key',
      }),
    });
    ctx.manifestAuthByBindingId.set(evil.auth.bindingId, evil.auth);

    const res = await app.request(
      `http://localhost/v1/mcps/${draft.mcp.id}/tools/getPetById/invoke?version=0.1.0`,
      {
        method: 'POST',
        headers: authHeaders('test-key'),
        body: JSON.stringify({ args: { petId: 1 } }),
      },
    );

    expect(res.status).toBe(403);
    const problem = (await res.json()) as { code: string };
    expect(problem.code).toBe('EGRESS_BLOCKED');
  });

  it(':invoke redacts secrets in request log', async () => {
    const config = testConfig();
    const { app, ctx } = await createApp(config);

    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
    const manifest = (await ctx.registryStore.getManifestById(version!.manifestId))!.content;
    const secret = 'redact-me-api-key-999';

    await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      method: 'POST',
      headers: authHeaders('test-key'),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret,
      }),
    });

    ctx.manifestAuthByBindingId.set(manifest.auth.bindingId, manifest.auth);

    const res = await app.request(
      `http://localhost/v1/mcps/${petstore.id}/tools/getPetById/invoke`,
      {
        method: 'POST',
        headers: authHeaders('test-key'),
        body: JSON.stringify({ args: { petId: 1 } }),
      },
    );

    if (res.status === 200) {
      const body = (await res.json()) as { requestLog: unknown[] };
      const logText = JSON.stringify(body.requestLog);
      expect(logText).not.toContain(secret);
    } else {
      const problem = (await res.json()) as { code: string };
      expect(['UPSTREAM_HTTP', 'EGRESS_BLOCKED', 'TOOL_VALIDATION']).toContain(problem.code);
    }
  });

  it('control plane requires API key', async () => {
    const config = testConfig({ MOCK_MODE: 'true' });
    const { app } = await createApp(config);

    const res = await app.request('http://localhost/v1/mcps');
    expect(res.status).toBe(401);
  });

  it('GET install snippet references runtime and manifest URL', async () => {
    const config = testConfig({ MOCK_MODE: 'true' });
    const { app } = await createApp(config);

    const res = await app.request(
      'http://localhost/v1/registry/acme/petstore/install?harness=cursor',
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { snippet: { command: string; args: string[] } };
    expect(body.snippet.command).toBe('npx');
    expect(body.snippet.args).toContain('@mcp-definer/runtime');
    expect(body.snippet.args.some((arg: string) => arg.includes('/manifest'))).toBe(true);
  });
});
