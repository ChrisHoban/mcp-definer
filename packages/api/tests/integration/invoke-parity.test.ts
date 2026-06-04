import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { Manifest } from '@mcp-definer/schemas';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

import { startMockUpstream, withMockEgress } from '../helpers/mock-upstream.js';
import { normalizeOutboundRequest } from '../helpers/normalize-request.js';
import { authHeaders, createTestApp, repoRoot } from '../helpers/test-app.js';

const TEST_SECRET = 'parity-test-secret-do-not-log';

describe('integration: invoke parity (ADR-012)', () => {
  it('runtime tools/call and API :invoke produce equivalent outbound requests', async () => {
    const mock = await startMockUpstream();
    try {
      const { app, ctx } = await createTestApp();
      const petstore = (await ctx.registryStore.listMcps()).items.find((m) => m.slug === 'petstore')!;
      const version = await ctx.registryStore.getLatestPublishedVersion(petstore.id);
      const stored = (await ctx.registryStore.getManifestById(version!.manifestId))!;
      const manifest = withMockEgress(stored.content, mock.baseUrl);

      const draft = await ctx.registryStore.createMcp({
        org: 'acme',
        slug: 'invoke-parity',
        name: 'Invoke Parity',
        description: 'ADR-012 parity test',
        visibility: 'private',
        ownerId: 'user_dev',
        manifest,
        version: '0.1.0',
      });
      await app.request(`http://localhost/v1/mcps/${draft.mcp.id}/credentials`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          id: manifest.auth.bindingId,
          authType: 'apiKey',
          config: manifest.auth.apply,
          secret: TEST_SECRET,
        }),
      });
      ctx.manifestAuthByBindingId.set(manifest.auth.bindingId, manifest.auth);

      mock.requests.length = 0;

      const apiRes = await app.request(
        `http://localhost/v1/mcps/${draft.mcp.id}/tools/getPetById/invoke?version=0.1.0`,
        {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ args: { petId: 7 } }),
        },
      );

      expect(apiRes.status).toBe(200);
      const apiBody = (await apiRes.json()) as { requestLog: Record<string, unknown>[] };
      expect(apiBody.requestLog.length).toBeGreaterThan(0);
      const apiSerialized = JSON.stringify(apiBody);
      expect(apiSerialized).not.toContain(TEST_SECRET);

      const apiNormalized = normalizeOutboundRequest(apiBody.requestLog[0]!);
      expect(apiNormalized.method).toBe('GET');
      expect(apiNormalized.pathname).toBe('/pet/7');
      expect(apiNormalized.hasApiKeyHeader).toBe(true);
      expect(apiNormalized.apiKeyHeaderRedacted).toBe(true);

      expect(mock.requests.length).toBe(1);
      const mockFromApi = mock.requests[0]!;
      expect(mockFromApi.method).toBe('GET');
      expect(mockFromApi.url).toBe('/pet/7');

      mock.requests.length = 0;

      const dir = await mkdtemp(join(tmpdir(), 'mcp-definer-parity-'));
      const manifestPath = join(dir, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      const cliPath = join(repoRoot, 'packages/runtime/dist/cli.js');
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [cliPath, '--manifest', manifestPath],
        env: {
          ...process.env,
          [`MCP_DEFINER_SECRET_${manifest.auth.bindingId}`]: TEST_SECRET,
        },
      });

      const client = new Client({ name: 'parity-runtime', version: '1.0.0' }, { capabilities: {} });
      await client.connect(transport);
      await client.callTool({ name: 'getPetById', arguments: { petId: 7 } });
      await client.close();

      expect(mock.requests.length).toBe(1);
      const mockFromRuntime = mock.requests[0]!;
      expect(mockFromRuntime.method).toBe('GET');
      expect(mockFromRuntime.url).toBe('/pet/7');

      const runtimeNormalized = normalizeOutboundRequest({
        method: mockFromRuntime.method,
        url: `${mock.baseUrl}${mockFromRuntime.url}`,
        headers: Object.fromEntries(
          Object.entries(mockFromRuntime.headers).map(([key, value]) => [
            key,
            Array.isArray(value) ? value[0] : value,
          ]),
        ),
      });

      expect(runtimeNormalized.method).toBe(apiNormalized.method);
      expect(runtimeNormalized.pathname).toBe(apiNormalized.pathname);
      expect(runtimeNormalized.hasApiKeyHeader).toBe(apiNormalized.hasApiKeyHeader);
    } finally {
      await mock.close();
    }
  }, 60_000);
});
