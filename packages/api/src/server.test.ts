import { describe, expect, it, vi } from 'vitest';
import type { Hono } from 'hono';

import { loadConfig } from './config.js';
import type { ApiEnv } from './middleware/auth.js';
import { registerSignalHandlers, startApiServer } from './server.js';

const { loadRepoEnvMock, shutdownAppContextMock, validateDatabaseMock, createAppMock } =
  vi.hoisted(() => ({
    loadRepoEnvMock: vi.fn(),
    shutdownAppContextMock: vi.fn().mockResolvedValue(undefined),
    validateDatabaseMock: vi.fn().mockResolvedValue({ ok: true, latencyMs: 2, migrationCount: 4 }),
    createAppMock: vi.fn(),
  }));

vi.mock('./load-repo-env.js', () => ({
  loadRepoEnv: loadRepoEnvMock,
}));

vi.mock('./app.js', () => ({
  createApp: createAppMock,
}));

vi.mock('./context.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./context.js')>();
  return {
    ...actual,
    shutdownAppContext: shutdownAppContextMock,
  };
});

vi.mock('@mcp-definer/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@mcp-definer/db')>();
  return {
    ...actual,
    validateDatabase: validateDatabaseMock,
  };
});

function mockAppResult(config: ReturnType<typeof loadConfig>, withDatabase = false) {
  const app = {
    request: vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 })),
    fetch: vi.fn(),
  } as unknown as Hono<ApiEnv>;

  createAppMock.mockResolvedValueOnce({
    app,
    ctx: {
      config,
      dbPool: withDatabase ? { query: vi.fn() } : null,
    },
  });

  return app;
}

describe('startApiServer', () => {
  it('loads env by default and starts the in-memory API', async () => {
    const serveFn = vi.fn();
    const config = loadConfig({
      MOCK_MODE: 'true',
      MCP_DEFINER_API_KEY: 'test-key',
      REGISTRY_STORE: 'memory',
      VITEST: 'true',
    } as NodeJS.ProcessEnv);
    const app = mockAppResult(config);

    const result = await startApiServer({ config, serveFn });

    expect(loadRepoEnvMock).toHaveBeenCalled();
    expect(serveFn).toHaveBeenCalledOnce();
    expect(result.app).toBe(app);

    const response = await result.app.request('http://localhost/health');
    expect(response.status).toBe(200);

    await result.shutdown();
    expect(shutdownAppContextMock).toHaveBeenCalledWith(result.ctx);
  });

  it('skips env loading and logs postgres health when configured', async () => {
    const serveFn = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = loadConfig({
      MOCK_MODE: 'true',
      MCP_DEFINER_API_KEY: 'test-key',
      REGISTRY_STORE: 'postgres',
      DATABASE_URL: 'postgresql://mcp_definer:mcp_definer@localhost:5432/mcp_definer',
      VITEST: 'true',
    } as NodeJS.ProcessEnv);
    mockAppResult(config, true);

    try {
      const result = await startApiServer({ config, loadEnv: false, serveFn });
      expect(validateDatabaseMock).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Database: connected'));
      await result.shutdown();
    } finally {
      logSpy.mockRestore();
    }
  });
});

describe('registerSignalHandlers', () => {
  it('shuts down context on SIGTERM', async () => {
    const exitMock = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const handlers = new Map<string, () => void>();
    vi.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      handlers.set(event, handler);
      return process;
    }) as typeof process.on);

    const ctx = { id: 'ctx' } as never;
    registerSignalHandlers(() => ctx);

    await handlers.get('SIGTERM')?.();

    expect(shutdownAppContextMock).toHaveBeenCalledWith(ctx);
    expect(exitMock).toHaveBeenCalledWith(0);

    exitMock.mockRestore();
  });
});
