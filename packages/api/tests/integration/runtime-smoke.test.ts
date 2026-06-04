import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

import { repoRoot } from '../helpers/test-app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('integration: runtime smoke', () => {
  it('stdio tools/list returns expected tool names from petstore fixture', async () => {
    const manifestPath = join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
    const cliPath = join(repoRoot, 'packages/runtime/dist/cli.js');

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliPath, '--manifest', manifestPath],
      env: {
        ...process.env,
        MCP_DEFINER_SECRET_cb_petstore_apikey: 'integration-test-key',
      },
    });

    const client = new Client({ name: 'integration-runtime', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);

    const listed = await client.listTools();
    const toolNames = listed.tools.map((tool) => tool.name).sort();

    expect(toolNames).toEqual(['findPetsByStatus', 'getPetById']);
    expect(manifest.mcpProtocolVersion).toBe('2024-11-05');

    await client.close();
  }, 30_000);
});
