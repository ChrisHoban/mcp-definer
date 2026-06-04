import { resolveDatabaseUrl } from '@mcp-definer/db';
import { secretEnvVarName } from '@mcp-definer/auth';
import { describe, expect, it, beforeAll } from 'vitest';

import { shutdownAppContext } from '../../src/context.js';
import { authHeaders, createTestApp, loadRepoText } from '../helpers/test-app.js';

const dbAvailable = process.env.SKIP_DB_TESTS !== 'true';

describe.skipIf(!dbAvailable)('integration: postgres registry + env credentials', () => {
  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = resolveDatabaseUrl();
    }
  });

  it('publish persists MCP; credential uses env secretRef; discovery index lists entry', async () => {
    const { app, ctx } = await createTestApp({
      REGISTRY_STORE: 'postgres',
      MOCK_MODE: 'false',
      RUN_MIGRATIONS_ON_STARTUP: 'true',
      SPEC_FETCH_ALLOWLIST: '',
    });

    const spec = loadRepoText('fixtures/openapi/petstore.yaml');
    const parseRes = await app.request('http://localhost/v1/specs/parse', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ content: spec, filename: 'petstore.yaml' }),
    });
    expect(parseRes.status).toBe(200);
    const parsed = (await parseRes.json()) as {
      ir: import('@mcp-definer/schemas').IntermediateRepresentation;
    };

    const slug = `pg-int-${Date.now()}`;
    const { mapIrToManifest, emptyCuration, applyCuration } =
      await import('@mcp-definer/generator');
    const base = mapIrToManifest(parsed.ir, {
      name: slug,
      displayName: 'Postgres Integration',
      authBindingId: 'cb_pg_int',
      securityScheme: 'api_key',
    });
    const manifest = applyCuration(base, emptyCuration(), parsed.ir);

    const createRes = await app.request('http://localhost/v1/mcps', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        org: 'acme',
        slug,
        name: 'Postgres Integration',
        manifest,
        version: '1.0.0',
        visibility: 'public',
      }),
    });
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; draftVersion: string };

    const secret = 'postgres-integration-secret';
    const credRes = await app.request(`http://localhost/v1/mcps/${created.id}/credentials`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        id: manifest.auth.bindingId,
        authType: 'apiKey',
        config: manifest.auth.apply,
        secret,
      }),
    });
    expect(credRes.status).toBe(201);
    const credBody = (await credRes.json()) as {
      binding: { secretRef: string; hasSecret: boolean };
    };
    expect(credBody.binding.secretRef).toContain('env:MCP_DEFINER_SECRET_');
    expect(credBody.binding.hasSecret).toBe(true);

    const publishRes = await app.request(
      `http://localhost/v1/mcps/${created.id}/versions/${created.draftVersion}/publish`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ channel: 'stable' }),
      },
    );
    expect(publishRes.status).toBe(200);

    const indexRes = await app.request('http://localhost/v1/index');
    expect(indexRes.status).toBe(200);
    const index = (await indexRes.json()) as { entries: Array<{ slug: string }> };
    expect(index.entries.some((e) => e.slug === slug)).toBe(true);

    expect(process.env[secretEnvVarName(manifest.auth.bindingId)]).toBe(secret);

    await shutdownAppContext(ctx);
  });
});
