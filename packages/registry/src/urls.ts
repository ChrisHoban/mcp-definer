const DEFAULT_BASE = '/v1';

export function normalizeBaseUrl(baseUrl?: string): string {
  if (!baseUrl || baseUrl === '') {
    return DEFAULT_BASE;
  }
  return baseUrl.replace(/\/+$/, '');
}

export function manifestPath(org: string, slug: string, version: string): string {
  return `/registry/${org}/${slug}/versions/${version}/manifest`;
}

export function installPath(org: string, slug: string, harness = 'cursor'): string {
  return `/registry/${org}/${slug}/install?harness=${harness}`;
}

export function manifestUrl(baseUrl: string, org: string, slug: string, version: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}${manifestPath(org, slug, version)}`;
}

export function installUrl(baseUrl: string, org: string, slug: string, harness = 'cursor'): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}${installPath(org, slug, harness)}`;
}
