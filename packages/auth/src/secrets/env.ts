/**
 * Env var convention for per-install local secrets (ADR-008).
 *
 * Example Cursor install snippet:
 * ```jsonc
 * "env": { "MCP_DEFINER_SECRET_cb_petstore_apikey": "<user-supplied at install>" }
 * ```
 */
export const SECRET_ENV_PREFIX = 'MCP_DEFINER_SECRET_';

/** Env var name for a binding's secret value at local runtime. */
export function secretEnvVarName(bindingId: string): string {
  return `${SECRET_ENV_PREFIX}${bindingId}`;
}

/** Read a binding secret from process.env (runtime only — not an API read-back path). */
export function readEnvSecret(
  bindingId: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const value = env[secretEnvVarName(bindingId)];
  return value === undefined || value === '' ? undefined : value;
}
