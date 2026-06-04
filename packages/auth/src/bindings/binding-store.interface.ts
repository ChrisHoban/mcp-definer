import type {
  CredentialBinding,
  CredentialBindingPublic,
  CreateCredentialBindingInput,
  UpdateCredentialBindingInput,
} from '../types/credential.js';

/** Credential binding persistence (metadata only — secrets live in env). */
export interface CredentialBindingStore {
  create(
    input: CreateCredentialBindingInput,
    secret?: string,
    orgSlug?: string,
  ): Promise<CredentialBindingPublic>;

  get(bindingId: string): Promise<CredentialBindingPublic | undefined>;

  getByMcpId(mcpId: string): Promise<CredentialBindingPublic | undefined>;

  update(
    bindingId: string,
    updates: UpdateCredentialBindingInput,
    secret?: string,
  ): Promise<CredentialBindingPublic>;

  delete(bindingId: string): Promise<void>;

  getBindingRecord(bindingId: string): Promise<CredentialBinding | undefined>;
}
