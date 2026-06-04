/** Write-only secret storage API — no read-back for control-plane consumers. */
export interface SecretStore {
  setSecret(bindingId: string, value: string): Promise<void>;
  hasSecret(bindingId: string): Promise<boolean>;
  deleteSecret(bindingId: string): Promise<void>;
}

export { EnvSecretStore } from './env-secret-store.js';
export { EnvSecretStore as InMemorySecretStore } from './env-secret-store.js';
