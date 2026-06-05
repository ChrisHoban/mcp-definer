import { emptyCuration, parseSpec } from '@mcp-definer/generator';
import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { authHeaders, createTestApp, loadRepoFixture, loadRepoText } from '../test-helpers.js';

function petstoreManifest(slug: string): Manifest {
  const base = loadRepoFixture<Manifest>('fixtures/manifests/petstore-apikey.manifest.json');
  return {
    ...base,
    name: slug,
    displayName: 'Route test MCP',
  };
}

async function createDraftViaApi(
  app: Awaited<ReturnType<typeof createTestApp>>['app'],
  slug: string,
) {
  const manifest = petstoreManifest(slug);

  const res = await app.request('http://localhost/v1/mcps', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      org: 'acme',
      slug,
      name: slug,
      description: 'Route test MCP',
      visibility: 'public',
      manifest,
      version: '0.1.0',
    }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as { id: string; draftVersion: string };
}

describe('discovery routes', () => {
  it('GET /v1/search returns catalog entries', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/search?q=pet');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[] };
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it('GET /v1/search supports tag and pagination params', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/search?tag=pets&limit=5');
    expect(res.status).toBe(200);
  });

  it('GET /v1/registry/:org/:slug returns MCP detail', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/registry/acme/petstore');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { org: string; slug: string; versions: unknown[] };
    expect(body.org).toBe('acme');
    expect(body.slug).toBe('petstore');
    expect(body.versions.length).toBeGreaterThan(0);
  });

  it('GET /v1/registry/:org/:slug returns 404 for unknown MCP', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/registry/acme/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('GET /v1/registry/:org/:slug/versions/:ver/manifest returns manifest', async () => {
    const { app } = await createTestApp();
    const res = await app.request(
      'http://localhost/v1/registry/acme/petstore/versions/1.0.0/manifest',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe('petstore');
  });

  it('GET /v1/registry/:org/:slug/install accepts version query', async () => {
    const { app } = await createTestApp();
    const res = await app.request(
      'http://localhost/v1/registry/acme/petstore/install?harness=cursor&version=1.0.0',
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { harness: string; snippet: { command: string } };
    expect(body.harness).toBe('cursor');
    expect(body.snippet.command).toBe('npx');
  });

  it('GET /v1/index respects limit query', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/index?limit=1');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: unknown[] };
    expect(body.entries.length).toBeLessThanOrEqual(1);
  });
});

describe('control plane routes', () => {
  it('POST /v1/specs/parse rejects empty body', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/specs/parse', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('POST /v1/specs/parse returns IR from pasted content', async () => {
    const { app } = await createTestApp();
    const spec = loadRepoText('fixtures/openapi/petstore.yaml');
    const res = await app.request('http://localhost/v1/specs/parse', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content: spec, filename: 'petstore.yaml' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { operationCount: number; format: string };
    expect(body.format).toBe('swagger2');
    expect(body.operationCount).toBeGreaterThan(10);
  });

  it('POST /v1/mcps rejects missing manifest and ir', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/mcps', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ slug: 'x', name: 'X' }),
    });
    expect(res.status).toBe(400);
  });

  it('runs draft → validate → publish → deprecate lifecycle', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'lifecyclemcp');

    const validateRes = await app.request(
      `http://localhost/v1/mcps/${created.id}/versions/${created.draftVersion}/validate`,
      { method: 'POST', headers: authHeaders() },
    );
    expect(validateRes.status).toBe(200);
    expect(((await validateRes.json()) as { valid: boolean }).valid).toBe(true);

    const publishRes = await app.request(
      `http://localhost/v1/mcps/${created.id}/versions/${created.draftVersion}/publish`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ channel: 'stable' }),
      },
    );
    expect(publishRes.status).toBe(200);

    const deprecateRes = await app.request(
      `http://localhost/v1/mcps/${created.id}/versions/${created.draftVersion}/deprecate`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ reason: 'test' }),
      },
    );
    expect(deprecateRes.status).toBe(200);
  });

  it('GET /v1/mcps lists with filters', async () => {
    const { app } = await createTestApp();
    const res = await app.request(
      'http://localhost/v1/mcps?status=published&visibility=public&limit=10',
      { headers: authHeaders() },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { slug: string }[] };
    expect(body.items.some((m) => m.slug === 'petstore')).toBe(true);
  });

  it('GET/PATCH/DELETE /v1/mcps/:id', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'patch-mcp');

    const getRes = await app.request(`http://localhost/v1/mcps/${created.id}`, {
      headers: authHeaders(),
    });
    expect(getRes.status).toBe(200);

    const patchRes = await app.request(`http://localhost/v1/mcps/${created.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Renamed MCP', tags: ['test'] }),
    });
    expect(patchRes.status).toBe(200);
    expect(((await patchRes.json()) as { name: string }).name).toBe('Renamed MCP');

    const deleteRes = await app.request(`http://localhost/v1/mcps/${created.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    expect(deleteRes.status).toBe(204);
  });

  it('POST /v1/mcps/:id/versions creates additional draft', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'multi-ver');
    const manifest = loadRepoFixture<Manifest>('fixtures/manifests/petstore-apikey.manifest.json');

    const res = await app.request(`http://localhost/v1/mcps/${created.id}/versions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ version: '0.2.0', manifest }),
    });
    expect(res.status).toBe(201);
    expect(((await res.json()) as { version: string }).version).toBe('0.2.0');
  });

  it('PATCH draft version updates manifest', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'draft-patch');
    const manifest = loadRepoFixture<Manifest>('fixtures/manifests/petstore-apikey.manifest.json');

    const res = await app.request(
      `http://localhost/v1/mcps/${created.id}/versions/${created.draftVersion}`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ manifest }),
      },
    );
    expect(res.status).toBe(200);
  });

  it('GET /v1/mcps/:id/versions/:ver returns version detail', async () => {
    const { app, ctx } = await createTestApp();
    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;

    const res = await app.request(`http://localhost/v1/mcps/${petstore.id}/versions/1.0.0`, {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tools: unknown[]; manifest: { name: string } };
    expect(body.manifest.name).toBe('petstore');
    expect(body.tools.length).toBeGreaterThan(0);
  });

  it('POST /v1/mcps/:id/versions/:ver/regenerate returns diff', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'regen-mcp');
    const spec = loadRepoText('fixtures/openapi/petstore.yaml');
    const { ir } = await parseSpec({ kind: 'text', content: spec, filename: 'petstore.yaml' });

    const res = await app.request(
      `http://localhost/v1/mcps/${created.id}/versions/${created.draftVersion}/regenerate`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ newIr: ir, curation: emptyCuration() }),
      },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { manifest: { name: string }; diff: unknown };
    expect(body.manifest.name).toBe('regen-mcp');
    expect(body.diff).toBeDefined();
  });

  it('POST /v1/mcps/:id/credentials and DELETE binding', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'cred-mcp');
    const manifest = loadRepoFixture<Manifest>('fixtures/manifests/petstore-apikey.manifest.json');

    const postRes = await app.request(`http://localhost/v1/mcps/${created.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret: 'route-test-secret',
      }),
    });
    expect(postRes.status).toBe(201);

    const delRes = await app.request(`http://localhost/v1/mcps/${created.id}/credentials`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    expect(delRes.status).toBe(204);
  });

  it('POST invoke without credentials returns 400', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'invoke-no-cred');

    const res = await app.request(
      `http://localhost/v1/mcps/${created.id}/tools/getPetById/invoke?version=0.1.0`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ args: { petId: 1 } }),
      },
    );
    expect(res.status).toBe(400);
  });

  it('GET /v1/audit returns audit events', async () => {
    const { app } = await createTestApp();
    await createDraftViaApi(app, 'audit-mcp');

    const res = await app.request('http://localhost/v1/audit', { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { action: string }[] };
    expect(body.items.some((e) => e.action === 'mcp.create')).toBe(true);
  });

  it('returns 403 when role lacks publish permission', async () => {
    const { app, ctx } = await createTestApp({ DEFAULT_ROLE: 'viewer' });
    const manifest = loadRepoFixture<Manifest>('fixtures/manifests/petstore-apikey.manifest.json');
    const { mcp, version } = await ctx.registryStore.createMcp({
      org: 'acme',
      slug: 'viewer-publish',
      name: 'Viewer Publish Test',
      description: 'test',
      visibility: 'private',
      ownerId: 'user_dev',
      manifest,
      version: '0.1.0',
    });

    const res = await app.request(
      `http://localhost/v1/mcps/${mcp.id}/versions/${version.version}/publish`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ channel: 'stable' }),
      },
    );
    expect(res.status).toBe(403);
  });

  it('returns 409 when credential binding already exists', async () => {
    const { app } = await createTestApp();
    const created = await createDraftViaApi(app, 'credconflict');
    const manifest = petstoreManifest('credconflict');

    const first = await app.request(`http://localhost/v1/mcps/${created.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret: 'secret-one',
      }),
    });
    expect(first.status).toBe(201);

    const second = await app.request(`http://localhost/v1/mcps/${created.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: 'cb_other',
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret: 'secret-two',
      }),
    });
    expect(second.status).toBe(409);
  });

  it('returns 404 for unknown MCP id', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/v1/mcps/mcp_unknown', {
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});

describe('app shell routes', () => {
  it('GET /health returns ok in memory mode', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('GET /openapi.yaml returns YAML spec', async () => {
    const { app } = await createTestApp();
    const res = await app.request('http://localhost/openapi.yaml');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('yaml');
    const text = await res.text();
    expect(text).toContain('openapi');
  });
});
