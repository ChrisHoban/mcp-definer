import type { DbPool } from '@mcp-definer/db';

import type { EnvSecretStore } from '../secrets/env-secret-store.js';
import {
  assertNoSecretFields,
  bindingHasSecret,
  createBindingRecord,
  toPublicBinding,
} from './binding.js';
import { BindingConflictError, BindingNotFoundError } from './binding-store.js';
import type { CredentialBindingStore } from './binding-store.interface.js';
import type {
  CredentialBinding,
  CredentialBindingPublic,
  CreateCredentialBindingInput,
  UpdateCredentialBindingInput,
} from '../types/credential.js';
import type { ManifestAuthType } from '@mcp-definer/schemas';

interface BindingRow {
  id: string;
  mcp_id: string;
  auth_type: ManifestAuthType;
  config: Record<string, unknown>;
  secret_ref: string;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: BindingRow): CredentialBinding {
  return {
    id: row.id,
    mcpId: row.mcp_id,
    authType: row.auth_type,
    config: row.config ?? {},
    secretRef: row.secret_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresBindingStore implements CredentialBindingStore {
  constructor(
    private readonly pool: DbPool,
    private readonly secretStore: EnvSecretStore,
  ) {}

  async create(
    input: CreateCredentialBindingInput,
    secret?: string,
    orgSlug?: string,
  ): Promise<CredentialBindingPublic> {
    const existing = await this.get(input.id);
    if (existing) {
      throw new BindingConflictError(`Binding already exists: ${input.id}`);
    }

    const mcpBinding = await this.getByMcpId(input.mcpId);
    if (mcpBinding) {
      throw new BindingConflictError(`MCP already has a binding (ADR-009): ${input.mcpId}`);
    }

    const binding = createBindingRecord(input, input.secretRef ?? undefined, orgSlug);
    if (secret !== undefined) {
      await this.secretStore.setSecret(binding.id, secret);
    }

    await this.pool.query(
      `INSERT INTO credential_bindings (id, mcp_id, auth_type, config, secret_ref)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        binding.id,
        binding.mcpId,
        binding.authType,
        JSON.stringify(binding.config),
        binding.secretRef,
      ],
    );

    const hasSecret = await bindingHasSecret(binding.id, this.secretStore);
    const pub = toPublicBinding(binding, hasSecret);
    assertNoSecretFields(pub);
    return pub;
  }

  async get(bindingId: string): Promise<CredentialBindingPublic | undefined> {
    const binding = await this.getBindingRecord(bindingId);
    if (!binding) {
      return undefined;
    }
    const hasSecret = await bindingHasSecret(bindingId, this.secretStore);
    const pub = toPublicBinding(binding, hasSecret);
    assertNoSecretFields(pub);
    return pub;
  }

  async getByMcpId(mcpId: string): Promise<CredentialBindingPublic | undefined> {
    const result = await this.pool.query<BindingRow>(
      `SELECT id, mcp_id, auth_type, config, secret_ref, created_at, updated_at
       FROM credential_bindings WHERE mcp_id = $1`,
      [mcpId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return this.get(row.id);
  }

  async update(
    bindingId: string,
    updates: UpdateCredentialBindingInput,
    secret?: string,
  ): Promise<CredentialBindingPublic> {
    const existing = await this.getBindingRecord(bindingId);
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

    await this.pool.query(
      `UPDATE credential_bindings
       SET auth_type = $2, config = $3, secret_ref = $4, updated_at = now()
       WHERE id = $1`,
      [bindingId, updated.authType, JSON.stringify(updated.config), updated.secretRef],
    );

    const hasSecret = await bindingHasSecret(bindingId, this.secretStore);
    const pub = toPublicBinding(updated, hasSecret);
    assertNoSecretFields(pub);
    return pub;
  }

  async delete(bindingId: string): Promise<void> {
    const result = await this.pool.query(`DELETE FROM credential_bindings WHERE id = $1`, [
      bindingId,
    ]);
    if ((result.rowCount ?? 0) === 0) {
      throw new BindingNotFoundError(bindingId);
    }
    await this.secretStore.deleteSecret(bindingId);
  }

  async getBindingRecord(bindingId: string): Promise<CredentialBinding | undefined> {
    const result = await this.pool.query<BindingRow>(
      `SELECT id, mcp_id, auth_type, config, secret_ref, created_at, updated_at
       FROM credential_bindings WHERE id = $1`,
      [bindingId],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : undefined;
  }
}
