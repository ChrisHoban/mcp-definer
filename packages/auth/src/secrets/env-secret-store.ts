import { readEnvSecret } from './env.js';
import type { SecretStore } from './secret-store.js';

/**
 * Environment-variable secret store (ADR-004, ADR-008).
 *
 * - Production: operators set `MCP_DEFINER_SECRET_{bindingId}` in the deployment environment.
 * - Dev/API: `setSecret` writes the current process env (and a transient overlay) so `:invoke`
 *   works without external secret managers; values are never persisted to Postgres or the registry.
 */
export class EnvSecretStore implements SecretStore {
  private readonly overlay = new Map<string, string>();
  private readonly env: NodeJS.ProcessEnv;

  constructor(env: NodeJS.ProcessEnv = process.env) {
    this.env = env;
  }

  async setSecret(bindingId: string, value: string): Promise<void> {
    this.overlay.set(bindingId, value);
    const envVar = `MCP_DEFINER_SECRET_${bindingId}`;
    this.env[envVar] = value;
  }

  async hasSecret(bindingId: string): Promise<boolean> {
    return this.overlay.has(bindingId) || readEnvSecret(bindingId, this.env) !== undefined;
  }

  async deleteSecret(bindingId: string): Promise<void> {
    this.overlay.delete(bindingId);
    const envVar = `MCP_DEFINER_SECRET_${bindingId}`;
    delete this.env[envVar];
  }

  /** @internal Resolver-only — not part of the public SecretStore contract. */
  resolveSecret(bindingId: string): string | undefined {
    return this.overlay.get(bindingId) ?? readEnvSecret(bindingId, this.env);
  }
}
