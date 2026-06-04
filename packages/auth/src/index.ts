// Types
export type { HttpRequest } from './types/http.js';
export type {
  CredentialBinding,
  CredentialBindingPublic,
  CreateCredentialBindingInput,
  UpdateCredentialBindingInput,
} from './types/credential.js';
export type { OrgRole, Visibility, Permission, OrgMembership } from './types/rbac.js';

// RBAC
export { ROLE_HIERARCHY, roleAtLeast, highestRole } from './rbac/roles.js';
export { hasPermission } from './rbac/permissions.js';
export { canViewMcp, type McpAccessContext } from './rbac/visibility.js';

// Secrets (write-only public API)
export { SECRET_ENV_PREFIX, secretEnvVarName, readEnvSecret } from './secrets/env.js';
export { ENV_SECRET_REF_PREFIX, envSecretRef, envVarNameFromSecretRef } from './secrets/env-ref.js';
export { EnvSecretStore, InMemorySecretStore, type SecretStore } from './secrets/secret-store.js';

// Credential bindings
export {
  defaultSecretRef,
  toPublicBinding,
  createBindingRecord,
  assertNoSecretFields,
} from './bindings/binding.js';
export type { CredentialBindingStore } from './bindings/binding-store.interface.js';
export {
  InMemoryBindingStore,
  BindingNotFoundError,
  BindingConflictError,
} from './bindings/binding-store.js';
export { PostgresBindingStore } from './bindings/postgres-binding-store.js';

// Credential resolver
export type { ResolvedCredential } from './resolver/resolved-credential.js';
export { isResolvedAuthType } from './resolver/resolved-credential.js';
export {
  type CredentialResolver,
  CredentialResolutionError,
} from './resolver/credential-resolver.js';
export { applyCredential } from './resolver/apply-auth.js';
export {
  EnvCredentialResolver,
  InMemoryCredentialResolver,
} from './resolver/env-credential-resolver.js';
export {
  OAuth2TokenCache,
  parseOAuth2ClientCredentialsSecret,
  parseBasicSecret,
  parseCustomSecret,
  type OAuth2TokenFetcher,
} from './resolver/oauth2-cc.js';
