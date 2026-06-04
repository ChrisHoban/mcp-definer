import {
  assertNoSecretFields,
  bindingHasSecret,
  createBindingRecord,
  toPublicBinding,
} from './binding.js';
import type { EnvSecretStore } from '../secrets/env-secret-store.js';
import type { CredentialBindingStore } from './binding-store.interface.js';
import type {
  CredentialBinding,
  CredentialBindingPublic,
  CreateCredentialBindingInput,
  UpdateCredentialBindingInput,
} from '../types/credential.js';

export class BindingNotFoundError extends Error {
  constructor(bindingId: string) {
    super(`Credential binding not found: ${bindingId}`);
    this.name = 'BindingNotFoundError';
  }
}

export class BindingConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BindingConflictError';
  }
}

/**
 * In-memory credential binding store for dev/test.
 * MVP: one binding per MCP (ADR-009).
 */
export class InMemoryBindingStore implements CredentialBindingStore {
  private readonly bindings = new Map<string, CredentialBinding>();
  private readonly mcpIndex = new Map<string, string>();

  constructor(private readonly secretStore: EnvSecretStore) {}

  async create(
    input: CreateCredentialBindingInput,
    secret?: string,
    orgSlug?: string,
  ): Promise<CredentialBindingPublic> {
    if (this.bindings.has(input.id)) {
      throw new BindingConflictError(`Binding already exists: ${input.id}`);
    }
    if (this.mcpIndex.has(input.mcpId)) {
      throw new BindingConflictError(`MCP already has a binding (ADR-009): ${input.mcpId}`);
    }

    const binding = createBindingRecord(input, input.secretRef, orgSlug);
    if (secret !== undefined) {
      await this.secretStore.setSecret(binding.id, secret);
    }

    this.bindings.set(binding.id, binding);
    this.mcpIndex.set(binding.mcpId, binding.id);

    const pub = toPublicBinding(binding, true);
    assertNoSecretFields(pub);
    return pub;
  }

  async get(bindingId: string): Promise<CredentialBindingPublic | undefined> {
    const binding = this.bindings.get(bindingId);
    if (!binding) {
      return undefined;
    }
    const hasSecret = await bindingHasSecret(bindingId, this.secretStore);
    const pub = toPublicBinding(binding, hasSecret);
    assertNoSecretFields(pub);
    return pub;
  }

  async getByMcpId(mcpId: string): Promise<CredentialBindingPublic | undefined> {
    const bindingId = this.mcpIndex.get(mcpId);
    if (!bindingId) {
      return undefined;
    }
    return this.get(bindingId);
  }

  async update(
    bindingId: string,
    updates: UpdateCredentialBindingInput,
    secret?: string,
  ): Promise<CredentialBindingPublic> {
    const existing = this.bindings.get(bindingId);
    if (!existing) {
      throw new BindingNotFoundError(bindingId);
    }

    const updated: CredentialBinding = {
      ...existing,
      authType: updates.authType ?? existing.authType,
      config: updates.config ?? existing.config,
      secretRef: updates.secretRef ?? existing.secretRef,
      updatedAt: new Date(),
    };

    if (secret !== undefined) {
      await this.secretStore.setSecret(bindingId, secret);
    }

    this.bindings.set(bindingId, updated);
    const hasSecret = await bindingHasSecret(bindingId, this.secretStore);
    const pub = toPublicBinding(updated, hasSecret);
    assertNoSecretFields(pub);
    return pub;
  }

  async delete(bindingId: string): Promise<void> {
    const existing = this.bindings.get(bindingId);
    if (!existing) {
      throw new BindingNotFoundError(bindingId);
    }
    this.bindings.delete(bindingId);
    this.mcpIndex.delete(existing.mcpId);
    await this.secretStore.deleteSecret(bindingId);
  }

  async getBindingRecord(bindingId: string): Promise<CredentialBinding | undefined> {
    return this.bindings.get(bindingId);
  }
}
