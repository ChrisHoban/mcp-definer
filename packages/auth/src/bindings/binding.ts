import type {
  CredentialBinding,
  CredentialBindingPublic,
  CreateCredentialBindingInput,
} from '../types/credential.js';
import type { SecretStore } from '../secrets/secret-store.js';
import { defaultSecretRef } from '../secrets/env-ref.js';

export { defaultSecretRef } from '../secrets/env-ref.js';

/** Strip any accidental secret fields; expose only metadata + secretRef. */
export function toPublicBinding(
  binding: CredentialBinding,
  hasSecret: boolean,
): CredentialBindingPublic {
  return {
    id: binding.id,
    mcpId: binding.mcpId,
    authType: binding.authType,
    config: binding.config,
    secretRef: binding.secretRef,
    hasSecret,
    createdAt: binding.createdAt,
    updatedAt: binding.updatedAt,
  };
}

export function createBindingRecord(
  input: CreateCredentialBindingInput,
  secretRef?: string,
  orgSlug?: string,
): CredentialBinding {
  const now = new Date();
  return {
    id: input.id,
    mcpId: input.mcpId,
    authType: input.authType,
    config: input.config ?? {},
    secretRef: input.secretRef ?? secretRef ?? defaultSecretRef(input.id, orgSlug),
    createdAt: now,
    updatedAt: now,
  };
}

/** Ensure a binding object never leaks secret values in API responses. */
export function assertNoSecretFields(binding: unknown): void {
  if (binding === null || typeof binding !== 'object') {
    return;
  }
  const forbidden = ['secret', 'secretValue', 'password', 'token', 'clientSecret', 'apiKey'];
  for (const key of forbidden) {
    if (key in (binding as Record<string, unknown>)) {
      throw new Error(`Binding must not expose secret field "${key}"`);
    }
  }
}

export async function bindingHasSecret(
  bindingId: string,
  secretStore: SecretStore,
): Promise<boolean> {
  return secretStore.hasSecret(bindingId);
}
