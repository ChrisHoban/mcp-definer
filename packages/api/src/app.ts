import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Hono } from 'hono';
import { cors } from 'hono/cors';

import { createAppContext, type AppContext } from './context.js';
import type { ApiConfig } from './config.js';
import type { ApiEnv } from './middleware/auth.js';
import { createControlPlaneRoutes } from './routes/control-plane.js';
import { createDiscoveryRoutes } from './routes/discovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function createApp(config: ApiConfig): Promise<{ app: Hono<ApiEnv>; ctx: AppContext }> {
  const ctx = await createAppContext(config);
  const app = new Hono<ApiEnv>();

  app.use('*', cors());

  app.get('/health', async (c) => {
    if (ctx.dbPool) {
      const { validateDatabase } = await import('@mcp-definer/db');
      const database = await validateDatabase(ctx.dbPool);
      return c.json(
        {
          status: database.ok ? 'ok' : 'degraded',
          registryStore: ctx.config.registryStore,
          database,
        },
        database.ok ? 200 : 503,
      );
    }
    return c.json({ status: 'ok', registryStore: ctx.config.registryStore, database: null });
  });

  app.get('/openapi.yaml', (c) => {
    const specPath = join(__dirname, '../openapi.yaml');
    const yaml = readFileSync(specPath, 'utf8');
    return c.text(yaml, 200, { 'Content-Type': 'application/yaml' });
  });

  const v1 = new Hono<ApiEnv>();

  v1.route('/', createDiscoveryRoutes(ctx));
  v1.route('/', createControlPlaneRoutes(ctx));

  app.route('/v1', v1);

  return { app, ctx };
}
