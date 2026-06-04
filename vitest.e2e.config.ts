import { config as loadEnv } from 'dotenv';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

import { resolveDatabaseUrl } from './packages/db/src/env.ts';

const requireFromRuntime = createRequire(resolve(import.meta.dirname, 'packages/runtime/package.json'));
const mcpSdkRoot = dirname(requireFromRuntime.resolve('@modelcontextprotocol/sdk/package.json'));

const root = import.meta.dirname;
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

const packagesDir = resolve(root, 'packages');
const e2eEnv = { ...process.env, VITEST: 'false' } as NodeJS.ProcessEnv;

export default defineConfig({
  resolve: {
    alias: {
      '@mcp-definer/schemas': resolve(packagesDir, 'schemas/src/index.ts'),
      '@mcp-definer/auth': resolve(packagesDir, 'auth/src/index.ts'),
      '@mcp-definer/db': resolve(packagesDir, 'db/src/index.ts'),
      '@mcp-definer/generator': resolve(packagesDir, 'generator/src/index.ts'),
      '@mcp-definer/registry': resolve(packagesDir, 'registry/src/index.ts'),
      '@mcp-definer/runtime': resolve(packagesDir, 'runtime/src/index.ts'),
      '@mcp-definer/request-pipeline': resolve(packagesDir, 'request-pipeline/src/index.ts'),
      '@mcp-definer/cli': resolve(packagesDir, 'cli/src/index.ts'),
      '@mcp-definer/api': resolve(packagesDir, 'api/src/index.ts'),
      '@modelcontextprotocol/sdk': mcpSdkRoot,
    },
  },
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 90_000,
    hookTimeout: 30_000,
    env: {
      REGISTRY_STORE: 'postgres',
      RUN_MIGRATIONS_ON_STARTUP: 'true',
      MOCK_MODE: 'false',
      DATABASE_URL: resolveDatabaseUrl(e2eEnv),
      VITEST: 'false',
    },
  },
});
