import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import type { Hono } from 'hono';

import { createApp } from './app.js';
import { loadConfig, type ApiConfig } from './config.js';
import { loadRepoEnv } from './load-repo-env.js';
import { shutdownAppContext, type AppContext } from './context.js';
import type { ApiEnv } from './middleware/auth.js';

type ServeFn = typeof serve;

export interface StartApiServerOptions {
  config?: ApiConfig;
  loadEnv?: boolean;
  serveFn?: ServeFn;
}

export interface StartApiServerResult {
  app: Hono<ApiEnv>;
  ctx: AppContext;
  shutdown: () => Promise<void>;
}

export async function startApiServer(
  options: StartApiServerOptions = {},
): Promise<StartApiServerResult> {
  if (options.loadEnv !== false) {
    loadRepoEnv();
  }

  const config = options.config ?? loadConfig();
  const serveFn = options.serveFn ?? serve;

  const appResult = await createApp(config);
  const { app, ctx } = appResult;

  if (config.registryStore === 'postgres' && ctx.dbPool) {
    const { validateDatabase } = await import('@mcp-definer/db');
    const health = await validateDatabase(ctx.dbPool);
    console.log(
      `Database: connected (${health.latencyMs}ms, ${health.migrationCount ?? 0} migrations applied)`,
    );
  }

  serveFn(
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

  return {
    app,
    ctx,
    shutdown: () => shutdownAppContext(ctx),
  };
}

export function registerSignalHandlers(getCtx: () => AppContext | undefined): void {
  const shutdown = async () => {
    const ctx = getCtx();
    if (ctx) {
      await shutdownAppContext(ctx);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
}

if (isDirectRun()) {
  let ctx: AppContext | undefined;

  startApiServer()
    .then((result) => {
      ctx = result.ctx;
      registerSignalHandlers(() => ctx);
    })
    .catch(async (error) => {
      console.error('Failed to start API server:', error instanceof Error ? error.message : error);
      if (ctx) {
        await shutdownAppContext(ctx);
      }
      process.exit(1);
    });
}
