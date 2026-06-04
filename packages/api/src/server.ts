import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { loadRepoEnv } from './load-repo-env.js';
import { shutdownAppContext } from './context.js';

loadRepoEnv();

const config = loadConfig();

let ctx: Awaited<ReturnType<typeof createApp>>['ctx'] | undefined;

try {
  const appResult = await createApp(config);
  ctx = appResult.ctx;
  const { app } = appResult;

  if (config.registryStore === 'postgres' && ctx.dbPool) {
    const { validateDatabase } = await import('@mcp-definer/db');
    const health = await validateDatabase(ctx.dbPool);
    console.log(
      `Database: connected (${health.latencyMs}ms, ${health.migrationCount ?? 0} migrations applied)`,
    );
  }

  serve(
    {
      fetch: app.fetch,
      port: config.port,
      hostname: config.host,
    },
    (info) => {
      console.log(`@mcp-definer/api listening on http://${info.address}:${info.port}`);
      console.log(`OpenAPI: http://localhost:${info.port}/openapi.yaml`);
      console.log(`Discovery index: http://localhost:${info.port}/v1/index`);
      console.log(`Registry store: ${config.registryStore}`);
      console.log(`Mock mode: ${config.mockMode}`);
      console.log('Control-plane auth: X-API-Key or Authorization Bearer (MCP_DEFINER_API_KEY)');
    },
  );
} catch (error) {
  console.error('Failed to start API server:', error instanceof Error ? error.message : error);
  if (ctx) {
    await shutdownAppContext(ctx);
  }
  process.exit(1);
}

process.on('SIGINT', async () => {
  if (ctx) {
    await shutdownAppContext(ctx);
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (ctx) {
    await shutdownAppContext(ctx);
  }
  process.exit(0);
});
