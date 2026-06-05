import { describe, expect, it, vi } from 'vitest';

import {
  OAuth2TokenCache,
  fetchOAuth2ClientCredentialsToken,
  parseBasicSecret,
  parseCustomSecret,
  parseOAuth2ClientCredentialsSecret,
} from './oauth2-cc.js';

describe('parseOAuth2ClientCredentialsSecret', () => {
  it('parses JSON client credentials', () => {
    expect(
      parseOAuth2ClientCredentialsSecret(
        JSON.stringify({ clientId: 'id', clientSecret: 'secret' }),
      ),
    ).toEqual({ clientId: 'id', clientSecret: 'secret' });
  });

  it('parses clientId:clientSecret format', () => {
    expect(parseOAuth2ClientCredentialsSecret('my-id:my-secret')).toEqual({
      clientId: 'my-id',
      clientSecret: 'my-secret',
    });
  });

  it('rejects invalid secret format', () => {
    expect(() => parseOAuth2ClientCredentialsSecret('not-valid')).toThrow(
      /JSON or clientId:clientSecret/,
    );
  });
});

describe('parseBasicSecret', () => {
  it('parses JSON username/password', () => {
    expect(parseBasicSecret(JSON.stringify({ username: 'u', password: 'p' }))).toEqual({
      username: 'u',
      password: 'p',
    });
  });

  it('parses user:pass format', () => {
    expect(parseBasicSecret('alice:secret')).toEqual({ username: 'alice', password: 'secret' });
  });
});

describe('parseCustomSecret', () => {
  it('parses JSON header map', () => {
    expect(parseCustomSecret(JSON.stringify({ 'X-Custom': 'value' }))).toEqual({
      'X-Custom': 'value',
    });
  });

  it('rejects non-object secrets', () => {
    expect(() => parseCustomSecret('plain-text')).toThrow(/JSON object/);
  });
});

describe('OAuth2TokenCache', () => {
  it('returns cached token until expiry', () => {
    vi.useFakeTimers();
    const cache = new OAuth2TokenCache();

    cache.set('cb_1', 'token-a', 3600);
    expect(cache.get('cb_1')).toBe('token-a');

    vi.advanceTimersByTime(3_600_000);
    expect(cache.get('cb_1')).toBeUndefined();

    vi.useRealTimers();
  });

  it('clears one binding or entire cache', () => {
    const cache = new OAuth2TokenCache();
    cache.set('cb_a', 'a', 3600);
    cache.set('cb_b', 'b', 3600);

    cache.clear('cb_a');
    expect(cache.get('cb_a')).toBeUndefined();
    expect(cache.get('cb_b')).toBe('b');

    cache.clear();
    expect(cache.get('cb_b')).toBeUndefined();
  });
});

describe('fetchOAuth2ClientCredentialsToken', () => {
  it('uses cache on second call without refetching', async () => {
    const cache = new OAuth2TokenCache();
    const fetcher = vi.fn(async () => ({
      access_token: 'fresh-token',
      expires_in: 3600,
    }));

    const secret = { clientId: 'id', clientSecret: 'secret' };
    const first = await fetchOAuth2ClientCredentialsToken(
      'cb_oauth',
      'https://auth.example.com/token',
      secret,
      ['read'],
      cache,
      fetcher,
    );
    const second = await fetchOAuth2ClientCredentialsToken(
      'cb_oauth',
      'https://auth.example.com/token',
      secret,
      ['read'],
      cache,
      fetcher,
    );

    expect(first).toBe('fresh-token');
    expect(second).toBe('fresh-token');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1].get('scope')).toBe('read');
  });
});
