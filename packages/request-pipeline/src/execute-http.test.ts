import type { HttpRequest } from '@mcp-definer/auth';
import type { ManifestPolicies } from '@mcp-definer/schemas';
import { describe, expect, it, vi } from 'vitest';

import { executeHttpWithRetries, type HttpFetchFn } from './execute-http.js';

const policies: ManifestPolicies = {
  egressAllowlist: ['example.com'],
  timeoutMs: 5_000,
  retries: { max: 2, backoffMs: 1 },
};

const request: HttpRequest = {
  method: 'GET',
  url: 'https://example.com/v1/items',
  headers: { Accept: 'application/json' },
};

describe('executeHttpWithRetries', () => {
  it('retries on 5xx and returns success response', async () => {
    const fetchFn = vi
      .fn<HttpFetchFn>()
      .mockResolvedValueOnce({
        status: 503,
        headers: {},
        body: null,
        text: '',
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { ok: true },
        text: '{"ok":true}',
      });

    const response = await executeHttpWithRetries(request, policies, fetchFn);

    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 4xx', async () => {
    const fetchFn = vi.fn<HttpFetchFn>().mockResolvedValue({
      status: 404,
      headers: {},
      body: null,
      text: '',
    });

    const response = await executeHttpWithRetries(request, policies, fetchFn);
    expect(response.status).toBe(404);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('retries after network failure then throws last error', async () => {
    const fetchFn = vi.fn<HttpFetchFn>().mockRejectedValue(new Error('network down'));

    await expect(
      executeHttpWithRetries(request, { ...policies, retries: { max: 1, backoffMs: 1 } }, fetchFn),
    ).rejects.toThrow('network down');

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
