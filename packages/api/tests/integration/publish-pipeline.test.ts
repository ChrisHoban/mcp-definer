import {
  applyCuration,
  emptyCuration,
  mapIrToManifest,
  parseSpec,
} from '@mcp-definer/generator';
import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { authHeaders, createTestApp, loadRepoFixture, loadRepoText, repoRoot } from '../helpers/test-app.js';
import { join } from 'node:path';

describe('integration: publish pipeline', () => {
  it('draft → validate → publish → PATCH published version returns 409', async () => {
    const { app, ctx } = await createTestApp({ MOCK_MODE: 'false' });

    const { ir } = await parseSpec({
      kind: 'file',
      path: join(repoRoot, 'fixtures/openapi/petstore.yaml'),
    });
    const curation = emptyCuration();
    const base = mapIrToManifest(ir, {
      name: 'petstore-int',
      displayName: 'Petstore Integration',
      description: 'Integration test MCP',
      authBindingId: 'cb_int_apikey',
      securityScheme: 'api_key',
    });
    const manifest = applyCuration(base, curation, ir);

    const createRes = await app.request('http://localhost/v1/mcps', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        org: 'acme',
        slug: 'petstore-int',
        name: 'Petstore Integration',
        description: 'Integration test MCP',
        visibility: 'public',
        manifest,
        version: '0.1.0',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; draftVersion: string };
    const mcpId = created.id;
    const version = created.draftVersion;

    const validateRes = await app.request(
      `http://localhost/v1/mcps/${mcpId}/versions/${version}/validate`,
      { method: 'POST', headers: authHeaders() },
    );
    expect(validateRes.status).toBe(200);
    const validation = (await validateRes.json()) as { valid: boolean };
    expect(validation.valid).toBe(true);

    const publishRes = await app.request(
      `http://localhost/v1/mcps/${mcpId}/versions/${version}/publish`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ channel: 'stable' }),
      },
    );
    expect(publishRes.status).toBe(200);

    const patchedManifest = loadRepoFixture<Manifest>(
      'fixtures/manifests/petstore-apikey.manifest.json',
    );
    const patchRes = await app.request(
      `http://localhost/v1/mcps/${mcpId}/versions/${version}`,
      {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ manifest: patchedManifest }),
      },
    );
    expect(patchRes.status).toBe(409);
    const problem = (await patchRes.json()) as { code: string };
    expect(problem.code).toBe('CONFLICT');

    const mcp = await ctx.registryStore.getMcpById(mcpId);
    expect(mcp?.latestVersionId).toBeTruthy();
  });
});
