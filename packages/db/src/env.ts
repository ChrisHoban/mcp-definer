/** Local-dev defaults documented in `.env.example`. Not used in production or strict e2e runs. */
export const DEV_DATABASE_URL = 'postgresql://mcp_definer:mcp_definer@localhost:5432/mcp_definer';

/** Matches `MCP_DEFINER_API_KEY` in `.env.example` for local control-plane auth. */
export const DEV_API_KEY = 'dev-api-key';

/** @deprecated Use {@link DEV_DATABASE_URL}. */
export const DEFAULT_DATABASE_URL = DEV_DATABASE_URL;

export class MissingEnvError extends Error {
  constructor(public readonly variableName: string) {
    super(
      `Missing required environment variable ${variableName}. Copy .env.example to .env and set it.`,
    );
    this.name = 'MissingEnvError';
  }
}

/**
 * Whether unset secrets may fall back to `.env.example` dev values.
 * Disabled for production and when `VITEST=false` (integration/e2e against real services).
 */
export function allowsDevDefaults(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  if (env.VITEST === 'false') {
    return false;
  }
  return true;
}

export function requireEnv(env: NodeJS.ProcessEnv, name: string, devFallback?: string): string {
  const value = env[name]?.trim();
  if (value) {
    return value;
  }
  if (devFallback !== undefined && allowsDevDefaults(env)) {
    return devFallback;
  }
  throw new MissingEnvError(name);
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return requireEnv(env, 'DATABASE_URL', DEV_DATABASE_URL);
}

export function resolveApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return requireEnv(env, 'MCP_DEFINER_API_KEY', DEV_API_KEY);
}
