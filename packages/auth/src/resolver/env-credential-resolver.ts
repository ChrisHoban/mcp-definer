import type { ManifestAuth } from '@mcp-definer/schemas';

import type { CredentialBindingStore } from '../bindings/binding-store.interface.js';
import type { EnvSecretStore } from '../secrets/env-secret-store.js';
import type {
  AuthApplyApiKey,
  AuthApplyBearer,
  AuthApplyCustom,
  AuthApplyOAuth2Cc,
} from '../types/auth-apply.js';
import type { HttpRequest } from '../types/http.js';
import { applyCredential } from './apply-auth.js';
import { CredentialResolutionError, type CredentialResolver } from './credential-resolver.js';
import {
  fetchOAuth2ClientCredentialsToken,
  OAuth2TokenCache,
  parseBasicSecret,
  parseCustomSecret,
  parseOAuth2ClientCredentialsSecret,
  type OAuth2TokenFetcher,
} from './oauth2-cc.js';
import type { ResolvedCredential } from './resolved-credential.js';
import { secretEnvVarName } from '../secrets/env.js';

export interface EnvCredentialResolverOptions {
  bindingStore: CredentialBindingStore;
  secretStore: EnvSecretStore;
  manifestAuthByBindingId?: Map<string, ManifestAuth>;
  tokenCache?: OAuth2TokenCache;
  tokenFetcher?: OAuth2TokenFetcher;
}

/**
 * Resolves credentials from env vars (`MCP_DEFINER_SECRET_{bindingId}`) per binding secretRef.
 * Binding metadata may be in-memory or Postgres; secrets are never read from the database.
 */
export class EnvCredentialResolver implements CredentialResolver {
  private readonly bindingStore: CredentialBindingStore;
  private readonly secretStore: EnvSecretStore;
  private readonly manifestAuthByBindingId: Map<string, ManifestAuth>;
  private readonly tokenCache: OAuth2TokenCache;
  private readonly tokenFetcher?: OAuth2TokenFetcher;

  constructor(options: EnvCredentialResolverOptions) {
    this.bindingStore = options.bindingStore;
    this.secretStore = options.secretStore;
    this.manifestAuthByBindingId = options.manifestAuthByBindingId ?? new Map();
    this.tokenCache = options.tokenCache ?? new OAuth2TokenCache();
    this.tokenFetcher = options.tokenFetcher;
  }

  async resolve(bindingId: string): Promise<ResolvedCredential> {
    const binding = await this.bindingStore.getBindingRecord(bindingId);
    const manifestAuth = this.manifestAuthByBindingId.get(bindingId);

    if (!binding && !manifestAuth) {
      throw new CredentialResolutionError(`Unknown binding: ${bindingId}`, bindingId);
    }

    const secret = this.secretStore.resolveSecret(bindingId);
    if (!secret) {
      throw new CredentialResolutionError(
        `No secret for binding ${bindingId}. Set environment variable ${secretEnvVarName(bindingId)}.`,
        bindingId,
      );
    }

    const authType = manifestAuth?.type ?? binding!.authType;

    switch (authType) {
      case 'apiKey': {
        const apply = manifestAuth?.apply as AuthApplyApiKey | undefined;
        if (!apply?.name) {
          throw new CredentialResolutionError('apiKey apply metadata missing name', bindingId);
        }
        return { bindingId, authType: 'apiKey', value: secret, apply };
      }
      case 'bearer': {
        const apply = (manifestAuth?.apply ?? {}) as AuthApplyBearer;
        return { bindingId, authType: 'bearer', token: secret, apply };
      }
      case 'basic': {
        const { username, password } = parseBasicSecret(secret);
        return { bindingId, authType: 'basic', username, password, apply: {} };
      }
      case 'custom': {
        const apply = manifestAuth?.apply as AuthApplyCustom | undefined;
        if (!apply?.headers) {
          throw new CredentialResolutionError('custom apply metadata missing headers', bindingId);
        }
        return {
          bindingId,
          authType: 'custom',
          headerValues: parseCustomSecret(secret),
          apply,
        };
      }
      case 'oauth2_cc': {
        const apply = manifestAuth?.apply as AuthApplyOAuth2Cc | undefined;
        if (!apply?.tokenUrl) {
          throw new CredentialResolutionError(
            'oauth2_cc apply metadata missing tokenUrl',
            bindingId,
          );
        }
        const clientCreds = parseOAuth2ClientCredentialsSecret(secret);
        const accessToken = await fetchOAuth2ClientCredentialsToken(
          bindingId,
          apply.tokenUrl,
          clientCreds,
          apply.scopes,
          this.tokenCache,
          this.tokenFetcher,
        );
        return { bindingId, authType: 'oauth2_cc', accessToken, apply };
      }
      case 'oauth2_ac':
        throw new CredentialResolutionError('oauth2_ac is deferred to Phase 4', bindingId);
      default:
        throw new CredentialResolutionError(`Unsupported auth type: ${authType}`, bindingId);
    }
  }

  apply(credential: ResolvedCredential, request: HttpRequest): HttpRequest {
    return applyCredential(credential, request);
  }
}

/** @deprecated Use EnvCredentialResolver */
export const InMemoryCredentialResolver = EnvCredentialResolver;
