import { isIP } from 'node:net';

export class SpecFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'INVALID_URL'
      | 'BLOCKED_HOST'
      | 'ALLOWLIST'
      | 'SIZE_LIMIT'
      | 'TIMEOUT'
      | 'HTTP_ERROR'
      | 'UNSUPPORTED_CONTENT',
  ) {
    super(message);
    this.name = 'SpecFetchError';
  }
}

export interface FetchSpecUrlOptions {
  /** Required host allow-list entries (same rules as egress allow-list). */
  allowlist: string[];
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
}

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_REDIRECTS = 3;

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata.google']);

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, '');
}

function hostMatchesAllowlist(host: string, allowed: string): boolean {
  const normalizedHost = normalizeHost(host);
  const normalizedAllowed = normalizeHost(allowed);
  if (normalizedHost === normalizedAllowed) {
    return true;
  }
  return normalizedHost.endsWith(`.${normalizedAllowed}`);
}

function isBlockedHostname(host: string): boolean {
  const normalized = normalizeHost(host);
  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }
  if (normalized.endsWith('.local') || normalized.endsWith('.internal')) {
    return true;
  }
  return false;
}

function isPrivateOrReservedIp(host: string): boolean {
  const version = isIP(host);
  if (version === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }
  if (version === 6) {
    const lower = host.toLowerCase();
    if (
      lower === '::1' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
  }
  return false;
}

function assertFetchAllowed(url: string, allowlist: string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SpecFetchError(`Invalid URL: ${url}`, 'INVALID_URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new SpecFetchError(`Blocked protocol: ${parsed.protocol}`, 'INVALID_URL');
  }

  const host = parsed.hostname;
  if (isBlockedHostname(host) || isPrivateOrReservedIp(host)) {
    throw new SpecFetchError(`Blocked host: ${host}`, 'BLOCKED_HOST');
  }

  if (allowlist.length === 0) {
    throw new SpecFetchError(
      'Remote spec fetch requires SPEC_FETCH_ALLOWLIST (comma-separated hosts)',
      'ALLOWLIST',
    );
  }

  const allowed = allowlist.some((entry) => hostMatchesAllowlist(host, entry));
  if (!allowed) {
    throw new SpecFetchError(`Host "${host}" is not in SPEC_FETCH_ALLOWLIST`, 'ALLOWLIST');
  }

  return parsed;
}

function filenameFromUrl(url: URL, contentType: string | null): string {
  const pathName = url.pathname.split('/').pop() ?? '';
  if (/\.(ya?ml|json)$/i.test(pathName)) {
    return pathName;
  }
  if (contentType?.includes('json')) {
    return 'openapi.json';
  }
  return 'openapi.yaml';
}

function parseAllowlistFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.SPEC_FETCH_ALLOWLIST?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function loadSpecFetchAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseAllowlistFromEnv(env);
}

/**
 * Fetch OpenAPI/Swagger document text from a remote URL (FR-01).
 * See ADR-013 in ARCHITECTURE_DECISIONS.md for security rules.
 */
export async function fetchSpecFromUrl(
  url: string,
  options: FetchSpecUrlOptions,
): Promise<{ content: string; filename: string }> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;

  let current = assertFetchAllowed(url, options.allowlist);
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'application/json, application/yaml, text/yaml, text/plain, */*' },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new SpecFetchError(`Redirect without Location from ${current}`, 'HTTP_ERROR');
        }
        redirects += 1;
        if (redirects > maxRedirects) {
          throw new SpecFetchError(`Too many redirects (max ${maxRedirects})`, 'HTTP_ERROR');
        }
        current = assertFetchAllowed(new URL(location, current).toString(), options.allowlist);
        continue;
      }

      if (!response.ok) {
        throw new SpecFetchError(`HTTP ${response.status} fetching ${current}`, 'HTTP_ERROR');
      }

      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > maxBytes) {
        throw new SpecFetchError(`Response exceeds max size (${maxBytes} bytes)`, 'SIZE_LIMIT');
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        throw new SpecFetchError(`Response exceeds max size (${maxBytes} bytes)`, 'SIZE_LIMIT');
      }

      const content = new TextDecoder('utf-8').decode(buffer);
      const filename = filenameFromUrl(current, contentType);
      return { content, filename };
    } catch (error) {
      if (error instanceof SpecFetchError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new SpecFetchError(`Timed out after ${timeoutMs}ms`, 'TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
