import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDatabaseUrl } from '@mcp-definer/db';

import type { ApiConfig } from '../../src/config.js';
import { loadConfig } from '../../src/config.js';
import { createApp } from '../../src/app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(__dirname, '../../../..');

export function loadRepoFixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as T;
}

export function loadRepoText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

export function authHeaders(apiKey = 'test-key') {
  return { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
}

export async function createTestApp(overrides: Partial<ApiConfig> & Record<string, string> = {}) {
  const env: Record<string, string> = {
    MOCK_MODE: 'true',
    MCP_DEFINER_API_KEY: 'test-key',
    REGISTRY_STORE: 'memory',
    RUN_MIGRATIONS_ON_STARTUP: 'true',
    ...overrides,
  };
  if (env.REGISTRY_STORE === 'postgres' && !env.DATABASE_URL) {
    env.DATABASE_URL = resolveDatabaseUrl({
      ...process.env,
      ...env,
      VITEST: 'true',
    } as NodeJS.ProcessEnv);
  }
  const vitestFlag =
    overrides.REGISTRY_STORE === 'postgres' ? { VITEST: 'false' } : { VITEST: 'true' };
  const config = loadConfig({ ...process.env, ...env, ...vitestFlag } as NodeJS.ProcessEnv);
  return createApp(config);
}
