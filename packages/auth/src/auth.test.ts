import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it, vi } from 'vitest';

import {
  EnvCredentialResolver,
  EnvSecretStore,
  InMemoryBindingStore,
  assertNoSecretFields,
  canViewMcp,
  hasPermission,
  secretEnvVarName,
  toPublicBinding,
  type CredentialBinding,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');

function loadManifest(name: string): Manifest {
  const path = join(repoRoot, 'fixtures/manifests', name);
  return JSON.parse(readFileSync(path, 'utf8')) as Manifest;
}

describe('RBAC', () => {
  it('author cannot publish; admin can', () => {
    expect(hasPermission('author', 'mcp:publish')).toBe(false);
    expect(hasPermission('admin', 'mcp:publish')).toBe(true);
  });

  it('viewer can read catalog; author can configure auth', () => {
    expect(hasPermission('viewer', 'catalog:read')).toBe(true);
    expect(hasPermission('viewer', 'mcp:configure_auth')).toBe(false);
    expect(hasPermission('author', 'mcp:configure_auth')).toBe(true);
  });

  it('only owner manages org settings and signing', () => {
    expect(hasPermission('admin', 'org:settings')).toBe(false);
    expect(hasPermission('owner', 'org:settings')).toBe(true);
    expect(hasPermission('owner', 'signing:manage')).toBe(true);
  });
});

describe('visibility', () => {
  const mcp = { visibility: 'private' as const, orgId: 'org-1', ownerId: 'user-owner' };

  it('allows public MCPs to anyone', () => {
    expect(canViewMcp(null, { ...mcp, visibility: 'public' })).toBe(true);
  });

  it('hides private MCPs from non-members', () => {
    expect(canViewMcp(null, mcp)).toBe(false);
  });

  it('allows org members to view org-visible MCPs', () => {
    expect(
      canViewMcp({ orgId: 'org-1', userId: 'user-2', role: 'viewer' }, {
        ...mcp,
        visibility: 'org',
      }),
    ).toBe(true);
  });

  it('allows owner to view private MCPs in their org', () => {
    expect(
      canViewMcp({ orgId: 'org-1', userId: 'user-owner', role: 'viewer' }, mcp, 'user-owner'),
    ).toBe(true);
  });
});

describe('secret env convention', () => {
  it('maps bindingId to MCP_DEFINER_SECRET_{bindingId}', () => {
    expect(secretEnvVarName('cb_petstore_apikey')).toBe('MCP_DEFINER_SECRET_cb_petstore_apikey');
    expect(secretEnvVarName('cb_123')).toBe('MCP_DEFINER_SECRET_cb_123');
  });
});

describe('write-only secret storage', () => {
  it('setSecret + hasSecret without exported read-back', async () => {
    const store = new EnvSecretStore();
    expect('getSecret' in (store as object)).toBe(false);
    expect('readSecret' in (store as object)).toBe(false);

    await store.setSecret('cb_test', 'sekrit');
    expect(await store.hasSecret('cb_test')).toBe(true);
  });

  it('binding public view never includes secret fields', () => {
    const binding: CredentialBinding = {
      id: 'cb_test',
      mcpId: 'mcp-1',
      authType: 'apiKey',
      config: { in: 'header', name: 'X-API-Key' },
      secretRef: 'env:MCP_DEFINER_SECRET_cb_test',
    };
    const pub = toPublicBinding(binding, true);
    assertNoSecretFields(pub);
    expect(pub).not.toHaveProperty('secret');
    expect(pub).not.toHaveProperty('secretValue');
    expect(pub.hasSecret).toBe(true);
  });
});

describe('InMemoryBindingStore', () => {
  it('creates binding with write-only secret', async () => {
    const secretStore = new EnvSecretStore();
    const store = new InMemoryBindingStore(secretStore);

    const created = await store.create(
      {
        id: 'cb_petstore_apikey',
        mcpId: 'mcp-petstore',
        authType: 'apiKey',
        config: { in: 'header', name: 'X-API-Key' },
      },
      'my-api-key',
      'acme',
    );

    expect(created.secretRef).toBe('env:MCP_DEFINER_SECRET_cb_petstore_apikey');
    expect(created.hasSecret).toBe(true);
    expect(created).not.toHaveProperty('secret');

    const fetched = await store.get('cb_petstore_apikey');
    expect(fetched?.hasSecret).toBe(true);
    expect(fetched).not.toHaveProperty('secret');
  });

  it('enforces one binding per MCP (ADR-009)', async () => {
    const secretStore = new EnvSecretStore();
    const store = new InMemoryBindingStore(secretStore);

    await store.create(
      { id: 'cb_a', mcpId: 'mcp-1', authType: 'apiKey' },
      'key-a',
    );

    await expect(
      store.create({ id: 'cb_b', mcpId: 'mcp-1', authType: 'bearer' }, 'token-b'),
    ).rejects.toThrow(/ADR-009/);
  });
});

describe('EnvCredentialResolver', () => {
  it('resolves apiKey from in-memory secret and applies to request', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const secretStore = new EnvSecretStore();
    const bindingStore = new InMemoryBindingStore(secretStore);

    await bindingStore.create(
      {
        id: manifest.auth.bindingId,
        mcpId: 'mcp-petstore',
        authType: manifest.auth.type,
        config: manifest.auth.apply as Record<string, unknown>,
      },
      'petstore-secret-key',
    );

    const resolver = new EnvCredentialResolver({
      bindingStore,
      secretStore,
      manifestAuthByBindingId: new Map([[manifest.auth.bindingId, manifest.auth]]),
    });

    const credential = await resolver.resolve(manifest.auth.bindingId);
    expect(credential.authType).toBe('apiKey');

    const request = resolver.apply(credential, {
      method: 'GET',
      url: 'https://petstore.swagger.io/v2/pet/1',
      headers: {},
    });

    expect(request.headers['X-API-Key']).toBe('petstore-secret-key');
  });

  it('resolves apiKey from env var using manifest-only mode', async () => {
    const manifest = loadManifest('petstore-apikey.manifest.json');
    const env = {
      [secretEnvVarName(manifest.auth.bindingId)]: 'env-api-key',
    };
    const secretStore = new EnvSecretStore(env);
    const bindingStore = new InMemoryBindingStore(secretStore);

    const resolver = new EnvCredentialResolver({
      bindingStore,
      secretStore,
      manifestAuthByBindingId: new Map([[manifest.auth.bindingId, manifest.auth]]),
    });

    const credential = await resolver.resolve(manifest.auth.bindingId);
    expect(credential.authType).toBe('apiKey');
    if (credential.authType === 'apiKey') {
      expect(credential.value).toBe('env-api-key');
    }
  });

  it('resolves oauth2_cc with mocked token fetch', async () => {
    const manifest = loadManifest('petstore-oauth2-cc.manifest.json');
    const secretStore = new EnvSecretStore();
    const bindingStore = new InMemoryBindingStore(secretStore);

    await bindingStore.create(
      {
        id: manifest.auth.bindingId,
        mcpId: 'mcp-oauth',
        authType: manifest.auth.type,
        config: manifest.auth.apply as Record<string, unknown>,
      },
      JSON.stringify({ clientId: 'cid', clientSecret: 'csecret' }),
    );

    const tokenFetcher = vi.fn(async () => ({
      access_token: 'access-token-xyz',
      expires_in: 3600,
    }));

    const resolver = new EnvCredentialResolver({
      bindingStore,
      secretStore,
      manifestAuthByBindingId: new Map([[manifest.auth.bindingId, manifest.auth]]),
      tokenFetcher,
    });

    const credential = await resolver.resolve(manifest.auth.bindingId);
    expect(credential.authType).toBe('oauth2_cc');
    expect(tokenFetcher).toHaveBeenCalledOnce();

    const request = resolver.apply(credential, {
      method: 'GET',
      url: 'https://petstore.swagger.io/v2/pet/findByStatus',
      headers: {},
    });

    expect(request.headers['Authorization']).toBe('Bearer access-token-xyz');
  });

  it('applies bearer token auth', async () => {
    const manifest = loadManifest('petstore-bearer.manifest.json');
    const secretStore = new EnvSecretStore();
    const bindingStore = new InMemoryBindingStore(secretStore);

    await bindingStore.create(
      {
        id: manifest.auth.bindingId,
        mcpId: 'mcp-bearer',
        authType: manifest.auth.type,
      },
      'static-bearer-token',
    );

    const resolver = new EnvCredentialResolver({
      bindingStore,
      secretStore,
      manifestAuthByBindingId: new Map([[manifest.auth.bindingId, manifest.auth]]),
    });

    const credential = await resolver.resolve(manifest.auth.bindingId);
    const request = resolver.apply(credential, {
      method: 'GET',
      url: 'https://petstore.swagger.io/v2/pet/1',
      headers: {},
    });

    expect(request.headers['Authorization']).toBe('Bearer static-bearer-token');
  });

  it('rejects oauth2_ac in MVP', async () => {
    const secretStore = new EnvSecretStore();
    const bindingStore = new InMemoryBindingStore(secretStore);
    await secretStore.setSecret('cb_ac', '{}');

    const resolver = new EnvCredentialResolver({
      bindingStore,
      secretStore,
      manifestAuthByBindingId: new Map([
        [
          'cb_ac',
          {
            bindingId: 'cb_ac',
            type: 'oauth2_ac',
            apply: {
              authorizationUrl: 'https://auth.example.com/authorize',
              tokenUrl: 'https://auth.example.com/token',
            },
          },
        ],
      ]),
    });

    await expect(resolver.resolve('cb_ac')).rejects.toThrow(/Phase 4/);
  });
});
