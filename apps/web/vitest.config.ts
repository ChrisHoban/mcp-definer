import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const repoRoot = resolve(import.meta.dirname, '../..');
const packagesDir = resolve(repoRoot, 'packages');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');

  return {
    envDir: repoRoot,
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
        '@mcp-definer/schemas': resolve(import.meta.dirname, 'src/lib/schemas-browser.ts'),
        '@mcp-definer/generator/apply-curation': resolve(
          packagesDir,
          'generator/src/apply-curation.ts',
        ),
        '@mcp-definer/generator/map-ir-to-manifest': resolve(
          packagesDir,
          'generator/src/map-ir-to-manifest.ts',
        ),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      env: {
        VITE_API_KEY: env.VITE_API_KEY ?? 'test-key',
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: '../../coverage/web',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      },
    },
  };
});
