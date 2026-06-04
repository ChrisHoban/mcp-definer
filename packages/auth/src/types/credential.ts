import type { ManifestAuthType } from '@mcp-definer/schemas';

/** Non-secret credential binding row shape (matches credential_bindings DDL). */
export interface CredentialBinding {
  id: string;
  mcpId: string;
  authType: ManifestAuthType;
  /** Non-secret apply metadata (header names, token URLs, etc.). */
  config: Record<string, unknown>;
  /** Pointer into vault/env — never contains the secret value itself. */
  secretRef: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** API-safe binding view — no secret values, only secretRef + metadata. */
export interface CredentialBindingPublic {
  id: string;
  mcpId: string;
  authType: ManifestAuthType;
  config: Record<string, unknown>;
  secretRef: string;
  hasSecret: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateCredentialBindingInput {
  id: string;
  mcpId: string;
  authType: ManifestAuthType;
  config?: Record<string, unknown>;
  secretRef?: string;
}

export interface UpdateCredentialBindingInput {
  authType?: ManifestAuthType;
  config?: Record<string, unknown>;
  secretRef?: string;
}
