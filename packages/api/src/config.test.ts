import { describe, expect, it } from 'vitest';

import { MissingEnvError, resolveApiKey, resolveDatabaseUrl } from '@mcp-definer/db';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('uses dev fallbacks in development when env vars are unset', () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      VITEST: 'true',
    } as NodeJS.ProcessEnv);

    expect(config.databaseUrl).toContain('mcp_definer');
    expect(config.apiKey).toBe('dev-api-key');
  });

  it('requires DATABASE_URL and MCP_DEFINER_API_KEY in production', () => {
    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow(MissingEnvError);

    expect(() =>
      loadConfig({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      } as NodeJS.ProcessEnv),
    ).toThrow(MissingEnvError);
  });

  it('accepts explicit env vars in production', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
      MCP_DEFINER_API_KEY: 'prod-secret-key',
    } as NodeJS.ProcessEnv);

    expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/db');
    expect(config.apiKey).toBe('prod-secret-key');
  });
});

describe('resolveDatabaseUrl', () => {
  it('requires DATABASE_URL when VITEST=false', () => {
    expect(() =>
      resolveDatabaseUrl({
        VITEST: 'false',
      } as NodeJS.ProcessEnv),
    ).toThrow(MissingEnvError);
  });
});

describe('resolveApiKey', () => {
  it('requires MCP_DEFINER_API_KEY when VITEST=false', () => {
    expect(() =>
      resolveApiKey({
        VITEST: 'false',
        DATABASE_URL: 'postgresql://localhost/db',
      } as NodeJS.ProcessEnv),
    ).toThrow(MissingEnvError);
  });
});
