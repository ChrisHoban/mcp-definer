/**
 * Normalize outbound HTTP metadata for ADR-012 invoke parity assertions.
 * Secret values must never appear in comparisons.
 */
export interface NormalizedOutboundRequest {
  method: string;
  pathname: string;
  hasApiKeyHeader: boolean;
  apiKeyHeaderRedacted: boolean;
}

export function normalizeOutboundRequest(
  entry: Record<string, unknown>,
): NormalizedOutboundRequest {
  const method = String(entry.method ?? 'GET').toUpperCase();
  const rawUrl = String(entry.url ?? '');
  let pathname = rawUrl;
  try {
    pathname = new URL(rawUrl).pathname;
  } catch {
    pathname = rawUrl.replace(/^https?:\/\/[^/]+/, '') || rawUrl;
  }

  const headers = (entry.headers ?? {}) as Record<string, string>;
  const apiKeyValue =
    headers['X-API-Key'] ?? headers['x-api-key'] ?? headers['api_key'] ?? headers['api-key'];
  const hasApiKeyHeader = apiKeyValue !== undefined && apiKeyValue !== '';

  return {
    method,
    pathname,
    hasApiKeyHeader,
    apiKeyHeaderRedacted: hasApiKeyHeader ? apiKeyValue === '[REDACTED]' : true,
  };
}
