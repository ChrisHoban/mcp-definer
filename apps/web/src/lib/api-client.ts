import { ApiError, type ApiProblem } from './api-types';

export { ApiError };

const STORAGE_KEY = 'mcp-definer-api-key';

export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL ?? '/v1';
}

export function getStoredApiKey(): string {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  }
  const fromEnv = import.meta.env.VITE_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV) {
    console.warn(
      'Missing VITE_API_KEY — set it in the repo-root .env (see .env.example). API requests may fail until configured in Settings.',
    );
  }
  return '';
}

export function setStoredApiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY, key);
}

export interface ApiClientOptions {
  apiKey?: string;
  baseUrl?: string;
}

async function parseProblem(res: Response): Promise<ApiProblem | undefined> {
  try {
    return (await res.json()) as ApiProblem;
  } catch {
    return undefined;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiClientOptions = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? getApiBaseUrl();
  const apiKey = options.apiKey ?? getStoredApiKey();
  const headers = new Headers(init.headers);
  headers.set('X-API-Key', apiKey);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (!res.ok) {
    const problem = await parseProblem(res);
    throw new ApiError(
      problem?.detail ?? problem?.title ?? `Request failed (${res.status})`,
      res.status,
      problem,
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export const api = {
  parseSpec: (body: { content?: string; url?: string; filename?: string }) =>
    apiFetch<import('./api-types').ParseSpecResponse>('/specs/parse', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  createMcp: (body: import('./api-types').CreateMcpRequest) =>
    apiFetch<import('./api-types').CreateMcpResponse>('/mcps', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getVersion: (mcpId: string, ver: string) =>
    apiFetch<import('./api-types').VersionDetailResponse>(
      `/mcps/${mcpId}/versions/${ver}`,
    ),

  patchVersion: (mcpId: string, ver: string, body: import('./api-types').PatchVersionRequest) =>
    apiFetch<{ id: string; version: string; channel: string | null; publishedAt: string | null }>(
      `/mcps/${mcpId}/versions/${ver}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  validateVersion: (mcpId: string, ver: string) =>
    apiFetch<import('./api-types').ValidationResponse>(
      `/mcps/${mcpId}/versions/${ver}/validate`,
      { method: 'POST', body: JSON.stringify({}) },
    ),

  publishVersion: (
    mcpId: string,
    ver: string,
    body: { channel?: 'stable' | 'beta'; changelog?: string },
  ) =>
    apiFetch<import('./api-types').PublishResponse>(
      `/mcps/${mcpId}/versions/${ver}/publish`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  getCredentials: (mcpId: string) =>
    apiFetch<import('./api-types').CredentialResponse>(`/mcps/${mcpId}/credentials`),

  createCredentials: (mcpId: string, body: import('./api-types').CreateCredentialRequest) =>
    apiFetch<import('./api-types').CredentialResponse>(`/mcps/${mcpId}/credentials`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listMcps: (params?: {
    cursor?: string;
    limit?: number;
    status?: string;
    visibility?: string;
    tag?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.status) qs.set('status', params.status);
    if (params?.visibility) qs.set('visibility', params.visibility);
    if (params?.tag) qs.set('tag', params.tag);
    const query = qs.toString();
    return apiFetch<import('./api-types').McpListResponse>(
      `/mcps${query ? `?${query}` : ''}`,
    );
  },

  getMcp: (id: string) => apiFetch<import('./api-types').McpDetailResponse>(`/mcps/${id}`),

  deleteMcp: (id: string) =>
    apiFetch<void>(`/mcps/${id}`, { method: 'DELETE' }),

  listVersions: (mcpId: string) =>
    apiFetch<import('./api-types').VersionListResponse>(`/mcps/${mcpId}/versions`),

  deprecateVersion: (mcpId: string, ver: string, reason?: string) =>
    apiFetch<{ version: string; deprecatedAt: string }>(
      `/mcps/${mcpId}/versions/${ver}/deprecate`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),

  regenerateVersion: (
    mcpId: string,
    ver: string,
    body: {
      newIr: import('@mcp-definer/schemas').IntermediateRepresentation;
      curation?: import('@mcp-definer/schemas').CurationProfile;
    },
  ) =>
    apiFetch<import('./api-types').RegenerateResponse>(
      `/mcps/${mcpId}/versions/${ver}/regenerate`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  createVersion: (
    mcpId: string,
    body: { version: string; manifest: import('@mcp-definer/schemas').Manifest },
  ) =>
    apiFetch<{ id: string; version: string; channel: string | null; publishedAt: string | null }>(
      `/mcps/${mcpId}/versions`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  invokeTool: (
    mcpId: string,
    tool: string,
    args: Record<string, unknown>,
    version?: string,
  ) => {
    const qs = version ? `?version=${encodeURIComponent(version)}` : '';
    return apiFetch<import('./api-types').InvokeToolResponse>(
      `/mcps/${mcpId}/tools/${encodeURIComponent(tool)}/invoke${qs}`,
      { method: 'POST', body: JSON.stringify({ args }) },
    );
  },

  listAudit: (orgId?: string) => {
    const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
    return apiFetch<import('./api-types').AuditListResponse>(`/audit${qs}`);
  },
};

/** Discovery reads — optional auth for org/private visibility. */
export async function discoveryFetch<T>(
  path: string,
  options: ApiClientOptions & { includeAuth?: boolean } = {},
): Promise<T> {
  const baseUrl = options.baseUrl ?? getApiBaseUrl();
  const headers = new Headers();
  if (options.includeAuth !== false) {
    headers.set('X-API-Key', options.apiKey ?? getStoredApiKey());
  }

  const res = await fetch(`${baseUrl}${path}`, { headers });

  if (!res.ok) {
    let problem: import('./api-types').ApiProblem | undefined;
    try {
      problem = (await res.json()) as import('./api-types').ApiProblem;
    } catch {
      /* ignore */
    }
    throw new ApiError(
      problem?.detail ?? problem?.title ?? `Request failed (${res.status})`,
      res.status,
      problem,
    );
  }

  return res.json() as Promise<T>;
}

export const discoveryApi = {
  getIndex: (params?: { cursor?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    return discoveryFetch<import('./api-types').DiscoveryIndexResponse>(
      `/index${query ? `?${query}` : ''}`,
    );
  },

  search: (params?: { q?: string; tag?: string; capability?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.tag) qs.set('tag', params.tag);
    if (params?.capability) qs.set('capability', params.capability);
    const query = qs.toString();
    return discoveryFetch<import('./api-types').SearchCatalogResponse>(
      `/search${query ? `?${query}` : ''}`,
    );
  },

  getRegistryDetail: (org: string, slug: string) =>
    discoveryFetch<import('./api-types').RegistryDetailResponse>(
      `/registry/${encodeURIComponent(org)}/${encodeURIComponent(slug)}`,
    ),

  getInstallSnippet: (org: string, slug: string, harness = 'cursor', version?: string) => {
    const qs = new URLSearchParams({ harness });
    if (version) qs.set('version', version);
    return discoveryFetch<import('./api-types').InstallSnippetResponse>(
      `/registry/${encodeURIComponent(org)}/${encodeURIComponent(slug)}/install?${qs}`,
    );
  },
};
