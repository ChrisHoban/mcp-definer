import { readFileSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ResolvedCredential } from '@mcp-definer/auth';
import type { Manifest } from '@mcp-definer/schemas';
import {
  assertEgressAllowed,
  buildHttpRequest,
  EgressBlockedError,
  executeToolCall,
  redactText,
  ToolValidationError,
  type HttpFetchFn,
} from '@mcp-definer/request-pipeline';
import { describe, expect, it, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function loadManifest(name: string): Manifest {
  return JSON.parse(
    readFileSync(join(repoRoot, 'fixtures/manifests', name), 'utf8'),
  ) as Manifest;
}

function mockCredential(): Extract<ResolvedCredential, { authType: 'apiKey' }> {
  return {
    bindingId: 'cb_petstore_apikey',
    authType: 'apiKey',
    value: 'super-secret-api-key-12345',
    apply: { in: 'header', name: 'X-API-Key' },
  };
}

describe('validateToolArgs via executeToolCall', () => {
  it('rejects invalid tool args before outbound HTTP', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;
    const fetch = vi.fn<HttpFetchFn>();

    await expect(
      executeToolCall(manifest, tool, {}, mockCredential(), { fetch }),
    ).rejects.toBeInstanceOf(ToolValidationError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects wrong argument types without outbound HTTP', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;
    const fetch = vi.fn<HttpFetchFn>();

    await expect(
      executeToolCall(manifest, tool, { petId: 'not-a-number' }, mockCredential(), { fetch }),
    ).rejects.toBeInstanceOf(ToolValidationError);

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('egress allow-list', () => {
  it('blocks requests to non-allowed hosts', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;
    const fetch = vi.fn<HttpFetchFn>();

    await expect(
      executeToolCall(
        manifest,
        tool,
        { petId: 1 },
        mockCredential(),
        {
          baseUrlOverride: 'https://evil.example.com/v2',
          fetch,
        },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('blocks off-host requests against a mock HTTP server', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;

    let server: HttpServer | undefined;
    await new Promise<void>((resolve) => {
      server = createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
      server!.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server!.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind mock HTTP server');
    }

    const blockedUrl = `http://127.0.0.1:${address.port}`;
    const request = buildHttpRequest(manifest, tool, { petId: 1 }, blockedUrl);

    expect(() => assertEgressAllowed(request.url, manifest.policies.egressAllowlist)).toThrow(
      EgressBlockedError,
    );

    await new Promise<void>((resolve, reject) => {
      server!.close((error) => (error ? reject(error) : resolve()));
    });
  });
});

describe('secret redaction', () => {
  it('redacts secret values from logged request metadata', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;
    const credential = mockCredential();
    const logged: Record<string, unknown>[] = [];

    const fetch: HttpFetchFn = async () => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { id: 1, name: 'doggie' },
      text: JSON.stringify({ id: 1, name: 'doggie', apiKey: credential.value }),
    });

    await executeToolCall(manifest, tool, { petId: 1 }, credential, {
      fetch,
      onRequest: (request) => logged.push(request),
    });

    const serialized = JSON.stringify(logged);
    expect(serialized).not.toContain(credential.value);
    expect(serialized).toContain('[REDACTED]');
  });

  it('redacts secrets from response text', () => {
    const credential = mockCredential();
    const redacted = redactText(`token=${credential.value}`, credential);
    expect(redacted).not.toContain(credential.value);
    expect(redacted).toContain('[REDACTED]');
  });
});

describe('successful tool call', () => {
  it('builds request and returns passthrough response', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;
    const credential = mockCredential();
    let capturedUrl = '';

    const fetch: HttpFetchFn = async (request) => {
      capturedUrl = request.url;
      expect(request.headers['X-API-Key']).toBe(credential.value);
      return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { id: 1 },
        text: '{"id":1}',
      };
    };

    const result = await executeToolCall(manifest, tool, { petId: 42 }, credential, { fetch });

    expect(capturedUrl).toBe('https://petstore.swagger.io/v2/pet/42');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });
});
