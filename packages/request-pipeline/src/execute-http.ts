import type { HttpRequest } from '@mcp-definer/auth';
import type { ManifestPolicies } from '@mcp-definer/schemas';

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  text: string;
}

export type HttpFetchFn = (
  request: HttpRequest,
  init: { signal: AbortSignal },
) => Promise<HttpResponse>;

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

async function parseResponseBody(response: Response): Promise<{ body: unknown; text: string }> {
  const text = await response.text();
  if (!text) {
    return { body: null, text: '' };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return { body: JSON.parse(text) as unknown, text };
    } catch {
      return { body: text, text };
    }
  }

  return { body: text, text };
}

export const defaultHttpFetch: HttpFetchFn = async (request, init) => {
  const headers = { ...request.headers };
  const initRequest: RequestInit = {
    method: request.method,
    headers,
    signal: init.signal,
  };

  if (request.body !== undefined && request.method !== 'GET' && request.method !== 'HEAD') {
    initRequest.body = JSON.stringify(request.body);
    headers['Content-Type'] ??= 'application/json';
  }

  const response = await fetch(request.url, initRequest);
  const { body, text } = await parseResponseBody(response);

  return {
    status: response.status,
    headers: headersToRecord(response.headers),
    body,
    text,
  };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeHttpWithRetries(
  request: HttpRequest,
  policies: ManifestPolicies,
  fetchFn: HttpFetchFn = defaultHttpFetch,
): Promise<HttpResponse> {
  const maxAttempts = policies.retries.max + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), policies.timeoutMs);

    try {
      const response = await fetchFn(request, { signal: controller.signal });
      clearTimeout(timeout);

      if (response.status >= 500 && attempt < maxAttempts - 1) {
        await sleep(policies.retries.backoffMs * (attempt + 1));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      if (attempt < maxAttempts - 1) {
        await sleep(policies.retries.backoffMs * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Outbound HTTP request failed');
}
