import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/test-app.js';

describe('integration: install snippet (ADR-008)', () => {
  it('published MCP install snippet contains npx, runtime, and manifest URL', async () => {
    const { app } = await createTestApp();

    const res = await app.request(
      'http://localhost/v1/registry/acme/petstore/install?harness=cursor',
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { harness: string; snippet: { command: string; args: string[] } };
    expect(body.harness).toBe('cursor');
    expect(body.snippet.command).toBe('npx');
    expect(body.snippet.args).toContain('@mcp-definer/runtime');
    expect(
      body.snippet.args.some((arg) => arg.includes('/v1/registry/acme/petstore/versions/1.0.0/manifest')),
    ).toBe(true);
  });
});
