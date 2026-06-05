import { describe, expect, it } from 'vitest';

import { applyCredential } from './apply-auth.js';

const baseRequest = {
  method: 'GET' as const,
  url: 'https://api.example.com/v1/items',
  headers: { Accept: 'application/json' },
};

describe('applyCredential', () => {
  it('applies apiKey in header', () => {
    const request = applyCredential(
      {
        bindingId: 'cb_key',
        authType: 'apiKey',
        value: 'key-123',
        apply: { in: 'header', name: 'X-API-Key' },
      },
      baseRequest,
    );
    expect(request.headers['X-API-Key']).toBe('key-123');
  });

  it('applies apiKey in query', () => {
    const request = applyCredential(
      {
        bindingId: 'cb_key',
        authType: 'apiKey',
        value: 'key-123',
        apply: { in: 'query', name: 'api_key' },
      },
      baseRequest,
    );
    expect(request.query?.api_key).toBe('key-123');
  });

  it('applies bearer token with custom header and prefix', () => {
    const request = applyCredential(
      {
        bindingId: 'cb_bearer',
        authType: 'bearer',
        token: 'tok',
        apply: { headerName: 'X-Auth', prefix: 'Token' },
      },
      baseRequest,
    );
    expect(request.headers['X-Auth']).toBe('Token tok');
  });

  it('applies basic auth Authorization header', () => {
    const request = applyCredential(
      {
        bindingId: 'cb_basic',
        authType: 'basic',
        username: 'alice',
        password: 'secret',
        apply: {},
      },
      baseRequest,
    );
    expect(request.headers.Authorization).toBe(
      `Basic ${Buffer.from('alice:secret').toString('base64')}`,
    );
  });

  it('applies custom headers with resolved values', () => {
    const request = applyCredential(
      {
        bindingId: 'cb_custom',
        authType: 'custom',
        apply: { headers: { 'X-Static': 'placeholder' } },
        headerValues: { 'X-Static': 'resolved', 'X-Extra': 'extra' },
      },
      baseRequest,
    );
    expect(request.headers['X-Static']).toBe('resolved');
    expect(request.headers['X-Extra']).toBe('extra');
  });

  it('applies oauth2 client credentials bearer token', () => {
    const request = applyCredential(
      {
        bindingId: 'cb_oauth',
        authType: 'oauth2_cc',
        accessToken: 'oauth-access',
        apply: { tokenUrl: 'https://auth.example.com/token' },
      },
      baseRequest,
    );
    expect(request.headers.Authorization).toBe('Bearer oauth-access');
  });
});
