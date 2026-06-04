import { resolveApiKey, resolveDatabaseUrl } from '@mcp-definer/db';

export interface ApiConfig {
  port: number;
  host: string;
  /** Public base URL for discovery links (e.g. http://localhost:3001/v1). */
  baseUrl: string;
  /** When true, seed fixture data on startup. */
  mockMode: boolean;
  /** Registry backend: postgres (default) or in-memory fallback. */
  registryStore: 'postgres' | 'memory';
  /** PostgreSQL connection string. */
  databaseUrl: string;
  /** When true, run pending migrations on startup. */
  runMigrationsOnStartup: boolean;
  /** API key for control-plane auth (Phase 1 stub). */
  apiKey: string;
  defaultOrgId: string;
  defaultOrgSlug: string;
  defaultUserId: string;
  defaultRole: 'owner' | 'admin' | 'author' | 'viewer';
  /** Host allow-list for remote OpenAPI URL import (ADR-013). Comma-separated in env. */
  specFetchAllowlist: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const port = Number(env.PORT ?? env.API_PORT ?? 3001);
  const host = env.HOST ?? '0.0.0.0';
  const basePath = '/v1';
  const publicHost = env.API_PUBLIC_URL ?? `http://localhost:${port}${basePath}`;

  const isTest = env.VITEST === 'true' || env.NODE_ENV === 'test';
  const registryStoreExplicit = env.REGISTRY_STORE as ApiConfig['registryStore'] | undefined;
  const registryStore = registryStoreExplicit ?? (isTest ? 'memory' : 'postgres');

  return {
    port,
    host,
    baseUrl: publicHost.replace(/\/+$/, ''),
    mockMode: env.MOCK_MODE !== 'false',
    registryStore,
    databaseUrl: resolveDatabaseUrl(env),
    runMigrationsOnStartup: env.RUN_MIGRATIONS_ON_STARTUP !== 'false',
    apiKey: resolveApiKey(env),
    defaultOrgId: env.DEFAULT_ORG_ID ?? 'org_acme',
    defaultOrgSlug: env.DEFAULT_ORG_SLUG ?? 'acme',
    defaultUserId: env.DEFAULT_USER_ID ?? 'user_dev',
    defaultRole: (env.DEFAULT_ROLE as ApiConfig['defaultRole']) ?? 'owner',
    specFetchAllowlist: (env.SPEC_FETCH_ALLOWLIST ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  };
}
