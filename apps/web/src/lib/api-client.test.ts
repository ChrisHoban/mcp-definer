import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-types';
import {
  api,
  apiFetch,
  discoveryApi,
  discoveryFetch,
  getApiBaseUrl,
  getStoredApiKey,
  setStoredApiKey,
} from './api-client';

describe('api key storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reads and writes API key in localStorage', () => {
    setStoredApiKey('my-key');
    expect(getStoredApiKey()).toBe('my-key');
  });

  it('falls back to VITE_API_KEY env in tests', () => {
    expect(getStoredApiKey()).toBeTruthy();
  });
});

describe('getApiBaseUrl', () => {
  it('defaults to /v1', () => {
    expect(getApiBaseUrl()).toBe('/v1');
  });
});

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setStoredApiKey('test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends X-API-Key and parses JSON body', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    const result = await apiFetch<{ ok: boolean }>('/mcps', {}, { baseUrl: 'https://api.test/v1' });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/v1/mcps',
      expect.objectContaining({
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('X-API-Key')).toBe('test-key');
  });

  it('throws ApiError with problem details on failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ title: 'Bad Request', detail: 'Invalid slug', code: 'BAD_REQUEST' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(apiFetch('/mcps', {}, { baseUrl: '/v1' })).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'Invalid slug',
    });
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const result = await apiFetch<void>('/mcps/x', { method: 'DELETE' }, { baseUrl: '/v1' });
    expect(result).toBeUndefined();
  });
});

describe('api client methods', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setStoredApiKey('test-key');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('listMcps builds query string', async () => {
    await api.listMcps({ cursor: 'c1', limit: 5, status: 'published', tag: 'pets' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/mcps?');
    expect(url).toContain('cursor=c1');
    expect(url).toContain('limit=5');
    expect(url).toContain('status=published');
    expect(url).toContain('tag=pets');
  });

  it('invokeTool encodes tool name and version', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ result: {}, requestLog: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await api.invokeTool('mcp_1', 'get/Pet', { petId: 1 }, '0.1.0');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/tools/get%2FPet/invoke');
    expect(url).toContain('version=0.1.0');
  });

  it('parseSpec POSTs JSON body', async () => {
    await api.parseSpec({ content: 'openapi: 3.0.0', filename: 'spec.yaml' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toMatchObject({ filename: 'spec.yaml' });
  });
});

describe('discoveryApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    setStoredApiKey('test-key');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ entries: [], nextCursor: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getIndex passes cursor and limit', async () => {
    await discoveryApi.getIndex({ cursor: 'abc', limit: 10 });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/index?');
  });

  it('search passes q, tag, and capability', async () => {
    await discoveryApi.search({ q: 'pet', tag: 'demo' });
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('q=pet');
    expect(url).toContain('tag=demo');
  });

  it('getInstallSnippet encodes org, slug, harness, and version', async () => {
    await discoveryApi.getInstallSnippet('acme', 'pet/store', 'cursor', '1.0.0');
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/registry/acme/pet%2Fstore/install');
    expect(url).toContain('harness=cursor');
    expect(url).toContain('version=1.0.0');
  });

  it('discoveryFetch can omit auth header', async () => {
    await discoveryFetch('/index', { includeAuth: false, baseUrl: '/v1' });
    const headers = fetchMock.mock.calls[0][1]?.headers as Headers | undefined;
    expect(headers?.get('X-API-Key')).toBeNull();
  });

  it('throws ApiError on discovery failure', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not found' }), { status: 404 }),
    );
    await expect(discoveryApi.getRegistryDetail('acme', 'missing')).rejects.toBeInstanceOf(ApiError);
  });
});
