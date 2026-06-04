import type { ResolvedCredential } from '@mcp-definer/auth';
import type { HttpRequest } from '@mcp-definer/auth';

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'proxy-authorization',
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectSecretValues(credential: ResolvedCredential): string[] {
  switch (credential.authType) {
    case 'apiKey':
      return [credential.value];
    case 'bearer':
      return [credential.token];
    case 'basic':
      return [credential.username, credential.password];
    case 'custom':
      return Object.values(credential.headerValues);
    case 'oauth2_cc':
      return [credential.accessToken];
    default:
      return [];
  }
}

export function redactHttpRequest(
  request: HttpRequest,
  credential: ResolvedCredential,
): Record<string, unknown> {
  const secrets = collectSecretValues(credential).filter((value) => value.length > 0);
  const redactedHeaders: Record<string, string> = {};

  for (const [name, value] of Object.entries(request.headers)) {
    if (SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) || secrets.includes(value)) {
      redactedHeaders[name] = '[REDACTED]';
    } else {
      redactedHeaders[name] = value;
    }
  }

  const redactedQuery: Record<string, string> | undefined = request.query
    ? Object.fromEntries(
        Object.entries(request.query).map(([key, value]) => [
          key,
          secrets.includes(value) ? '[REDACTED]' : value,
        ]),
      )
    : undefined;

  return {
    method: request.method,
    url: request.url,
    headers: redactedHeaders,
    query: redactedQuery,
    body: request.body,
  };
}

export function redactText(text: string, credential: ResolvedCredential): string {
  let redacted = text;
  for (const secret of collectSecretValues(credential)) {
    if (secret.length === 0) {
      continue;
    }
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), '[REDACTED]');
  }
  return redacted;
}
