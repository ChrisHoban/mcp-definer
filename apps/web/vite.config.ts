import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = resolve(import.meta.dirname, '../..');

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
          import.meta.dirname,
          '../../packages/generator/src/apply-curation.ts',
        ),
        '@mcp-definer/generator/map-ir-to-manifest': resolve(
          import.meta.dirname,
          '../../packages/generator/src/map-ir-to-manifest.ts',
        ),
      },
    },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      proxy: {
        '/v1': {
          target: `http://localhost:${env.API_PORT ?? 3001}`,
          changeOrigin: true,
        },
      },
    },
    build: {
      target: 'es2022',
    },
  };
});
