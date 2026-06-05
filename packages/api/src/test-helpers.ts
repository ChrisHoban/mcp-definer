import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, type ApiConfig } from './config.js';
import { createApp } from './app.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = join(__dirname, '../../..');

export function loadRepoFixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(repoRoot, relativePath), 'utf8')) as T;
}

export function loadRepoText(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

export function authHeaders(apiKey = 'test-key') {
  return { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };
}

export function testConfig(overrides: Record<string, string> = {}): ApiConfig {
  return loadConfig({
    MOCK_MODE: 'true',
    MCP_DEFINER_API_KEY: 'test-key',
    REGISTRY_STORE: 'memory',
    VITEST: 'true',
    ...overrides,
  } as NodeJS.ProcessEnv);
}

export async function createTestApp(overrides: Record<string, string> = {}) {
  const config = testConfig(overrides);
  return createApp(config);
}
