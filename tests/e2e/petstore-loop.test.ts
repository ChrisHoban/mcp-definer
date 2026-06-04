import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { secretEnvVarName } from '@mcp-definer/auth';
import { runInstall } from '../../packages/cli/src/commands/install.js';
import { readMcpConfig } from '../../packages/cli/src/mcp-config.js';
import {
  applyCuration,
  emptyCuration,
  mapIrToManifest,
  parseSpec,
} from '@mcp-definer/generator';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

import { startMockUpstream, withMockEgress } from '../../packages/api/tests/helpers/mock-upstream.js';
import { shutdownAppContext } from '../../packages/api/src/context.js';
import { authHeaders, createTestApp, loadRepoText, repoRoot } from '../../packages/api/tests/helpers/test-app.js';

const E2E_SECRET = 'e2e-petstore-secret-not-in-logs';

describe('E2E: Petstore acceptance loop', () => {
  it('import → draft → credential → validate → publish → index → install → runtime → mock upstream', async () => {
    const mock = await startMockUpstream();
    const workDir = await mkdtemp(join(tmpdir(), 'mcp-definer-e2e-'));
    let ctx: Awaited<ReturnType<typeof createTestApp>>['ctx'] | undefined;

    try {
      const testApp = await createTestApp({
        REGISTRY_STORE: 'postgres',
        MOCK_MODE: 'false',
        RUN_MIGRATIONS_ON_STARTUP: 'true',
        API_PUBLIC_URL: 'http://localhost:3001/v1',
      });
      const { app, ctx: appCtx } = testApp;
      ctx = appCtx;

      const spec = loadRepoText('fixtures/openapi/petstore.yaml');
      const parseRes = await app.request('http://localhost/v1/specs/parse', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: spec, filename: 'petstore.yaml' }),
      });
      expect(parseRes.status).toBe(200);
      const parsed = (await parseRes.json()) as { ir: import('@mcp-definer/schemas').IntermediateRepresentation };
      expect(parsed.ir.operations.length).toBe(20);

      const slug = `petstore-e2e-${Date.now()}`;
      const bindingId = `cb_e2e_${Date.now()}`;

      const curation = emptyCuration();
      const base = mapIrToManifest(parsed.ir, {
        name: slug,
        displayName: 'Petstore E2E',
        description: 'End-to-end acceptance MCP',
        authBindingId: bindingId,
        securityScheme: 'api_key',
      });
      let manifest = applyCuration(base, curation, parsed.ir);
      manifest = withMockEgress(manifest, mock.baseUrl);

      const createRes = await app.request('http://localhost/v1/mcps', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          org: 'acme',
          slug,
          name: 'Petstore E2E',
          description: 'End-to-end acceptance MCP',
          visibility: 'public',
          manifest,
          version: '1.0.0',
        }),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string; draftVersion: string };
      const mcpId = created.id;
      const version = created.draftVersion;

      await app.request(`http://localhost/v1/mcps/${mcpId}/credentials`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          id: manifest.auth.bindingId,
          authType: 'apiKey',
          config: manifest.auth.apply,
          secret: E2E_SECRET,
        }),
      });
      ctx.manifestAuthByBindingId.set(manifest.auth.bindingId, manifest.auth);

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

      const indexRes = await app.request('http://localhost/v1/index');
      expect(indexRes.status).toBe(200);
      const index = (await indexRes.json()) as { entries: Array<{ org: string; slug: string }> };
      expect(index.entries.some((e) => e.org === 'acme' && e.slug === slug)).toBe(true);

      const configPath = join(workDir, 'mcp.json');
      const envVar = secretEnvVarName(manifest.auth.bindingId);
      process.env[envVar] = E2E_SECRET;

      const installCode = await runInstall([`acme/${slug}`], {
        testRegistryStore: ctx.registryStore,
        registryUrl: 'http://localhost:3001/v1',
        configPath,
        yes: true,
      });
      expect(installCode).toBe(0);

      const mcpConfig = await readMcpConfig(configPath);
      expect(mcpConfig.mcpServers?.[slug]).toBeDefined();
      expect(mcpConfig.mcpServers?.[slug].command).toBe('npx');
      expect(mcpConfig.mcpServers?.[slug].args).toContain('@mcp-definer/runtime');
      expect(mcpConfig.mcpServers?.[slug].args?.some((a) => a.includes('/manifest'))).toBe(true);

      const configSerialized = JSON.stringify(mcpConfig);
      expect(configSerialized).not.toContain(E2E_SECRET);

      const published = await ctx.registryStore.getVersion('acme', slug, version);
      const publishedManifest = (
        await ctx.registryStore.getManifestById(published!.manifestId)
      )!.content;
      const runtimeManifest = withMockEgress(publishedManifest, mock.baseUrl);
      const manifestPath = join(workDir, 'runtime-manifest.json');
      await writeFile(manifestPath, JSON.stringify(runtimeManifest, null, 2));

      mock.requests.length = 0;

      const cliPath = join(repoRoot, 'packages/runtime/dist/cli.js');
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [cliPath, '--manifest', manifestPath],
        env: {
          ...process.env,
          [envVar]: E2E_SECRET,
        },
      });

      const client = new Client({ name: 'e2e-petstore', version: '1.0.0' }, { capabilities: {} });
      await client.connect(transport);

      const tools = await client.listTools();
      expect(tools.tools.some((t) => t.name === 'getPetById')).toBe(true);

      await client.callTool({ name: 'getPetById', arguments: { petId: 42 } });
      await client.close();

      expect(mock.requests.length).toBeGreaterThan(0);
      const hit = mock.requests.find((r) => r.method === 'GET' && r.url === '/pet/42');
      expect(hit).toBeDefined();
      const apiKeyHeader = hit!.headers['x-api-key'] ?? hit!.headers['api_key'];
      const headerValue = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
      expect(headerValue).toBe(E2E_SECRET);
    } finally {
      await mock.close();
      await rm(workDir, { recursive: true, force: true });
      if (ctx) {
        await shutdownAppContext(ctx);
      }
    }
  }, 90_000);
});
