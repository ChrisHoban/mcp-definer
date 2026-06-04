import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

const envPath = resolve(import.meta.dirname, '.env');
if (existsSync(envPath)) {
  loadEnv({ path: envPath });
}

const packagesDir = resolve(import.meta.dirname, 'packages');

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
    },
  },
  test: {
    passIfNoTests: true,
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
  },
});
