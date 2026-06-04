import { EgressBlockedError } from './errors.js';

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

export function assertEgressAllowed(url: string, allowlist: string[]): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new EgressBlockedError(`Invalid request URL: ${url}`, '', allowlist);
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new EgressBlockedError(
      `Blocked non-HTTP(S) protocol: ${parsed.protocol}`,
      parsed.hostname,
      allowlist,
    );
  }

  const host = parsed.hostname;
  const allowed = allowlist.some((entry) => hostMatchesAllowlist(host, entry));

  if (!allowed) {
    throw new EgressBlockedError(
      `Request to host "${host}" is not in egress allow-list`,
      host,
      allowlist,
    );
  }
}
