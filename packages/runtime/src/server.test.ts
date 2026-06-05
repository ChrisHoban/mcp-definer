import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';
import type { ResolvedCredential } from '@mcp-definer/auth';
import {
  EgressBlockedError,
  ToolValidationError,
  UpstreamHttpError,
} from '@mcp-definer/request-pipeline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRuntimeServer, serveStdio } from './server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

const { executeToolCallMock } = vi.hoisted(() => ({
  executeToolCallMock: vi.fn(),
}));

vi.mock('@mcp-definer/request-pipeline', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mcp-definer/request-pipeline')>();
  return {
    ...actual,
    executeToolCall: executeToolCallMock,
  };
});

const connectMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class MockStdioServerTransport {
    start = vi.fn();
    close = vi.fn();
  },
}));

vi.mock('@modelcontextprotocol/sdk/server/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@modelcontextprotocol/sdk/server/index.js')>();
  return {
    ...actual,
    Server: class extends actual.Server {
      override connect(...args: Parameters<actual.Server['connect']>) {
        connectMock(...args);
        return super.connect(...args);
      }
    },
  };
});

function loadPetstoreManifest(): Manifest {
  return JSON.parse(
    readFileSync(join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json'), 'utf8'),
  ) as Manifest;
}

function manifestWithExtras(base: Manifest): Manifest {
  return {
    ...base,
    resources: [
      {
        uri: 'petstore://info',
        name: 'Store info',
        description: 'Pet store metadata',
        mimeType: 'text/plain',
      },
    ],
    prompts: [
      {
        name: 'summarize',
        description: 'Summarize pet inventory',
        arguments: [{ name: 'status', required: false }],
      },
    ],
  };
}

async function connectClient(manifest: Manifest) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createRuntimeServer({ manifest });
  await server.connect(serverTransport);

  const client = new Client({ name: 'runtime-unit-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(clientTransport);
  return { client, server };
}

describe('createRuntimeServer', () => {
  beforeEach(() => {
    executeToolCallMock.mockReset();
    connectMock.mockClear();
    process.env.MCP_DEFINER_SECRET_cb_petstore_apikey = 'test-key';
  });

  it('lists enabled tools', async () => {
    const { client } = await connectClient(loadPetstoreManifest());
    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(['findPetsByStatus', 'getPetById']);
    await client.close();
  });

  it('lists, reads resources, and resolves prompts', async () => {
    const { client } = await connectClient(manifestWithExtras(loadPetstoreManifest()));

    const resources = await client.listResources();
    expect(resources.resources).toHaveLength(1);

    const resource = await client.readResource({ uri: 'petstore://info' });
    expect(resource.contents[0]?.text).toContain('metadata');

    const prompts = await client.listPrompts();
    expect(prompts.prompts[0]?.name).toBe('summarize');

    const prompt = await client.getPrompt({ name: 'summarize', arguments: {} });
    expect(prompt.messages[0]?.content.type).toBe('text');

    await client.close();
  });

  it('rejects unknown resources and prompts', async () => {
    const { client } = await connectClient(manifestWithExtras(loadPetstoreManifest()));

    await expect(client.readResource({ uri: 'petstore://missing' })).rejects.toThrow(
      /Unknown resource/,
    );
    await expect(client.getPrompt({ name: 'missing', arguments: {} })).rejects.toThrow(
      /Unknown prompt/,
    );

    await client.close();
  });

  it('returns tool results and upstream errors', async () => {
    executeToolCallMock.mockResolvedValueOnce({ status: 200, data: { id: 1, name: 'Fluffy' } });

    const { client } = await connectClient(loadPetstoreManifest());
    const success = await client.callTool({ name: 'getPetById', arguments: { petId: 1 } });
    expect(success.content[0]?.type).toBe('text');
    expect(String(success.content[0]?.text)).toContain('Fluffy');

    executeToolCallMock.mockRejectedValueOnce(new UpstreamHttpError('upstream failed', 502, 'bad'));
    const upstream = await client.callTool({ name: 'getPetById', arguments: { petId: 2 } });
    expect(upstream.isError).toBe(true);
    expect(String(upstream.content[0]?.text)).toContain('bad');

    await client.close();
  });

  it('maps validation, egress, and unknown tool failures', async () => {
    const manifest = loadPetstoreManifest();
    const { client } = await connectClient(manifest);

    await expect(client.callTool({ name: 'missingTool', arguments: {} })).rejects.toThrow(
      /Unknown tool/,
    );

    executeToolCallMock.mockRejectedValueOnce(
      new ToolValidationError('validation failed', ['petId required']),
    );
    await expect(client.callTool({ name: 'getPetById', arguments: {} })).rejects.toThrow(
      /Invalid arguments/,
    );

    executeToolCallMock.mockRejectedValueOnce(
      new EgressBlockedError('blocked', 'blocked.example.com', []),
    );
    await expect(client.callTool({ name: 'getPetById', arguments: { petId: 3 } })).rejects.toThrow(
      /blocked/,
    );

    executeToolCallMock.mockRejectedValueOnce(new Error('unexpected'));
    await expect(client.callTool({ name: 'getPetById', arguments: { petId: 4 } })).rejects.toThrow(
      /unexpected/,
    );

    await client.close();
  });

  it('uses a custom credential resolver and string tool results', async () => {
    const manifest = loadPetstoreManifest();
    const credential: ResolvedCredential = {
      bindingId: manifest.auth.bindingId,
      authType: 'apiKey',
      value: 'custom-key',
      apply: { in: 'header', name: 'X-API-Key' },
    };

    executeToolCallMock.mockResolvedValueOnce({ status: 200, data: 'plain-text-response' });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createRuntimeServer({
      manifest,
      credentialResolver: { resolve: vi.fn().mockResolvedValue(credential) },
    });
    await server.connect(serverTransport);

    const client = new Client({ name: 'runtime-unit-test', version: '1.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);

    const result = await client.callTool({ name: 'getPetById', arguments: { petId: 5 } });
    expect(result.content[0]?.text).toBe('plain-text-response');

    await client.close();
  });
});

describe('serveStdio', () => {
  it('connects the runtime server to stdio transport', async () => {
    await serveStdio(loadPetstoreManifest());
    expect(connectMock).toHaveBeenCalled();
  });
});
