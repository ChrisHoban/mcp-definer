export interface OAuth2ClientCredentialsSecret {
  clientId: string;
  clientSecret: string;
}

export interface OAuth2TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface TokenCacheEntry {
  accessToken: string;
  expiresAt: number;
}

export type OAuth2TokenFetcher = (
  tokenUrl: string,
  body: URLSearchParams,
) => Promise<OAuth2TokenResponse>;

const DEFAULT_TOKEN_FETCHER: OAuth2TokenFetcher = async (tokenUrl, body) => {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    throw new Error(`OAuth2 token request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as OAuth2TokenResponse;
};

export function parseOAuth2ClientCredentialsSecret(raw: string): OAuth2ClientCredentialsSecret {
  try {
    const parsed = JSON.parse(raw) as Partial<OAuth2ClientCredentialsSecret>;
    if (parsed.clientId && parsed.clientSecret) {
      return { clientId: parsed.clientId, clientSecret: parsed.clientSecret };
    }
  } catch {
    // fall through to clientId:clientSecret format
  }

  const colon = raw.indexOf(':');
  if (colon > 0) {
    return {
      clientId: raw.slice(0, colon),
      clientSecret: raw.slice(colon + 1),
    };
  }

  throw new Error('OAuth2 client credentials secret must be JSON or clientId:clientSecret');
}

export function parseBasicSecret(raw: string): { username: string; password: string } {
  try {
    const parsed = JSON.parse(raw) as { username?: string; password?: string };
    if (parsed.username && parsed.password) {
      return { username: parsed.username, password: parsed.password };
    }
  } catch {
    // fall through
  }

  const colon = raw.indexOf(':');
  if (colon > 0) {
    return { username: raw.slice(0, colon), password: raw.slice(colon + 1) };
  }

  throw new Error('Basic auth secret must be JSON {username,password} or user:pass');
}

export function parseCustomSecret(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    }
    if (Object.keys(headers).length > 0) {
      return headers;
    }
  } catch {
    // fall through
  }
  throw new Error('Custom auth secret must be a JSON object of header values');
}

export class OAuth2TokenCache {
  private readonly cache = new Map<string, TokenCacheEntry>();

  get(bindingId: string): string | undefined {
    const entry = this.cache.get(bindingId);
    if (!entry) {
      return undefined;
    }
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(bindingId);
      return undefined;
    }
    return entry.accessToken;
  }

  set(bindingId: string, accessToken: string, expiresInSeconds?: number): void {
    const ttlMs = (expiresInSeconds ?? 3600) * 1000;
    this.cache.set(bindingId, {
      accessToken,
      expiresAt: Date.now() + ttlMs - 30_000,
    });
  }

  clear(bindingId?: string): void {
    if (bindingId) {
      this.cache.delete(bindingId);
    } else {
      this.cache.clear();
    }
  }
}

export async function fetchOAuth2ClientCredentialsToken(
  bindingId: string,
  tokenUrl: string,
  secret: OAuth2ClientCredentialsSecret,
  scopes: string[] | undefined,
  cache: OAuth2TokenCache,
  fetcher: OAuth2TokenFetcher = DEFAULT_TOKEN_FETCHER,
): Promise<string> {
  const cached = cache.get(bindingId);
  if (cached) {
    return cached;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: secret.clientId,
    client_secret: secret.clientSecret,
  });
  if (scopes && scopes.length > 0) {
    body.set('scope', scopes.join(' '));
  }

  const token = await fetcher(tokenUrl, body);
  cache.set(bindingId, token.access_token, token.expires_in);
  return token.access_token;
}
