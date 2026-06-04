import { describe, expect, it } from 'vitest';

import { fetchSpecFromUrl, SpecFetchError } from './fetch-spec-url.js';

describe('fetchSpecFromUrl', () => {
  it('rejects empty allow-list', async () => {
    await expect(
      fetchSpecFromUrl('https://example.com/openapi.yaml', { allowlist: [] }),
    ).rejects.toMatchObject({ code: 'ALLOWLIST' });
  });

  it('blocks localhost', async () => {
    await expect(
      fetchSpecFromUrl('http://localhost/spec.yaml', { allowlist: ['localhost'] }),
    ).rejects.toMatchObject({ code: 'BLOCKED_HOST' });
  });

  it('blocks hosts not on allow-list', async () => {
    await expect(
      fetchSpecFromUrl('https://evil.example/openapi.yaml', { allowlist: ['petstore.swagger.io'] }),
    ).rejects.toMatchObject({ code: 'ALLOWLIST' });
  });
});

describe('SpecFetchError', () => {
  it('exposes stable codes', () => {
    const err = new SpecFetchError('test', 'TIMEOUT');
    expect(err.code).toBe('TIMEOUT');
  });
});
