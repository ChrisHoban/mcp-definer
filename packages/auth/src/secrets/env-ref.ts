import { secretEnvVarName } from './env.js';

/** secretRef prefix for environment-variable-backed secrets (ADR-004, deployment). */
export const ENV_SECRET_REF_PREFIX = 'env:';

/** Build a secretRef pointing at the standard install/runtime env var for a binding. */
export function envSecretRef(bindingId: string): string {
  return `${ENV_SECRET_REF_PREFIX}${secretEnvVarName(bindingId)}`;
}

/** Resolve env var name from a secretRef, when it uses the env: scheme. */
export function envVarNameFromSecretRef(secretRef: string): string | undefined {
  if (!secretRef.startsWith(ENV_SECRET_REF_PREFIX)) {
    return undefined;
  }
  const name = secretRef.slice(ENV_SECRET_REF_PREFIX.length);
  return name.length > 0 ? name : undefined;
}

/** Default secretRef for new bindings — always env-scoped for portable deployment. */
export function defaultSecretRef(bindingId: string, _orgSlug?: string): string {
  return envSecretRef(bindingId);
}
