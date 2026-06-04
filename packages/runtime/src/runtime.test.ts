import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';

import { loadManifest } from './manifest-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function fixturePath(name: string): string {
  return join(repoRoot, 'fixtures/manifests', name);
}

describe('manifest loader', () => {
  it('loads and validates petstore-apikey fixture', async () => {
    const manifest = await loadManifest(fixturePath('petstore-apikey.manifest.json'));

    expect(manifest.name).toBe('petstore');
    expect(manifest.mcpProtocolVersion).toBe('2024-11-05');
    expect(manifest.tools.filter((tool) => tool.enabled)).toHaveLength(2);
  });
});

describe('runtime stdio server', () => {
  it('tools/list returns expected tools from petstore fixture', async () => {
    const manifestPath = fixturePath('petstore-apikey.manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
    const cliPath = join(__dirname, '../dist/cli.js');

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [cliPath, '--manifest', manifestPath],
      env: {
        ...process.env,
        MCP_DEFINER_SECRET_cb_petstore_apikey: 'test-key',
      },
    });

    const client = new Client({ name: 'runtime-test', version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);

    const listed = await client.listTools();
    const toolNames = listed.tools.map((tool) => tool.name).sort();

    expect(toolNames).toEqual(['findPetsByStatus', 'getPetById']);
    expect(listed.tools.find((tool) => tool.name === 'getPetById')?.description).toContain('pet');
    expect(manifest.mcpProtocolVersion).toBe('2024-11-05');

    await client.close();
  }, 30_000);
});
