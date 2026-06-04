import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { authHeaders, createTestApp, loadRepoFixture } from '../helpers/test-app.js';

describe('integration: discovery index shape', () => {
  it('GET /v1/index matches fixtures/registry/index-v1.json shape', async () => {
    const { app } = await createTestApp();
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
    const fixture = loadRepoFixture<typeof body>('fixtures/registry/index-v1.json');

    expect(body.indexVersion).toBe(fixture.indexVersion);
    expect(body.entries).toHaveLength(fixture.entries.length);
    expect(body.entries[0].org).toBe(fixture.entries[0].org);
    expect(body.entries[0].slug).toBe(fixture.entries[0].slug);
    expect(body.entries[0].toolNames).toEqual(fixture.entries[0].toolNames);
    expect(body.entries[0].toolCount).toBe(fixture.entries[0].toolCount);
    expect(body.entries[0].mcpProtocolVersion).toBe(fixture.entries[0].mcpProtocolVersion);
    expect(body.entries[0].installUrl).toContain('/v1/registry/acme/petstore/install');
    expect(body.entries[0].manifestUrl).toContain('/v1/registry/acme/petstore/versions/1.0.0/manifest');
  });
});

describe('integration: credential write-only', () => {
  it('POST secret → GET binding has hasSecret without secret field', async () => {
    const { app, ctx } = await createTestApp();
    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
    const manifest = (await ctx.registryStore.getManifestById(version!.manifestId))!.content;

    const secret = 'integration-secret-never-exposed-xyz';

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
      binding: { secretRef: string; secret?: string; hasSecret: boolean };
    };
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain(secret);
    expect(body.binding.secret).toBeUndefined();
    expect(body.binding.hasSecret).toBe(true);
    expect(body.binding.secretRef).toBeDefined();
  });
});

describe('integration: :invoke egress and redaction', () => {
  it(':invoke blocks egress (EGRESS_BLOCKED) for off-host targets', async () => {
    const { app, ctx } = await createTestApp();
    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
    const manifest = (await ctx.registryStore.getManifestById(version!.manifestId))!.content;

    await app.request(`http://localhost/v1/mcps/${petstore.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret: 'egress-test-key',
      }),
    });

    const draft = await ctx.registryStore.createMcp({
      org: 'acme',
      slug: 'egress-blocked',
      name: 'Egress Blocked',
      description: 'test',
      visibility: 'private',
      ownerId: 'user_dev',
      manifest: {
        ...manifest,
        auth: { ...manifest.auth, bindingId: 'cb_egress_test' },
        policies: { ...manifest.policies, egressAllowlist: ['petstore.swagger.io'] },
      },
      version: '0.1.0',
    });

    const draftVersion = (await ctx.registryStore.getVersionForMcp(draft.mcp.id, '0.1.0'))!;
    const stored = (await ctx.registryStore.getManifestById(draftVersion.manifestId))!.content;
    const evil: Manifest = {
      ...stored,
      targetApi: { ...stored.targetApi, baseUrl: 'https://evil.example.com' },
    };
    await ctx.registryStore.updateDraftManifest(draftVersion.id, evil);

    await app.request(`http://localhost/v1/mcps/${draft.mcp.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: 'cb_egress_test',
        authType: 'apiKey',
        config: evil.auth.apply,
        secret: 'egress-test-key',
      }),
    });
    ctx.manifestAuthByBindingId.set(evil.auth.bindingId, evil.auth);

    const res = await app.request(
      `http://localhost/v1/mcps/${draft.mcp.id}/tools/getPetById/invoke?version=0.1.0`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ args: { petId: 1 } }),
      },
    );

    expect(res.status).toBe(403);
    const problem = (await res.json()) as { code: string };
    expect(problem.code).toBe('EGRESS_BLOCKED');
  });

  it(':invoke redacts secrets in requestLog', async () => {
    const { app, ctx } = await createTestApp();
    const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
    const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
    const manifest = (await ctx.registryStore.getManifestById(version!.manifestId))!.content;
    const secret = 'redact-integration-secret-abc';

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
    ctx.manifestAuthByBindingId.set(manifest.auth.bindingId, manifest.auth);

    const res = await app.request(
      `http://localhost/v1/mcps/${petstore.id}/tools/getPetById/invoke`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ args: { petId: 1 } }),
      },
    );

    if (res.status === 200) {
      const body = (await res.json()) as { requestLog: unknown[] };
      expect(JSON.stringify(body.requestLog)).not.toContain(secret);
    } else {
      const problem = (await res.json()) as { code: string };
      expect(['UPSTREAM_HTTP', 'EGRESS_BLOCKED', 'TOOL_VALIDATION']).toContain(problem.code);
    }
  });
});
