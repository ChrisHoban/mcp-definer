import type { ManifestAuthType } from '@mcp-definer/schemas';

import type {
  AuthApplyApiKey,
  AuthApplyBasic,
  AuthApplyBearer,
  AuthApplyCustom,
  AuthApplyOAuth2Cc,
} from '../types/auth-apply.js';

export type ResolvedCredential =
  | {
      bindingId: string;
      authType: 'apiKey';
      value: string;
      apply: AuthApplyApiKey;
    }
  | {
      bindingId: string;
      authType: 'bearer';
      token: string;
      apply: AuthApplyBearer;
    }
  | {
      bindingId: string;
      authType: 'basic';
      username: string;
      password: string;
      apply: AuthApplyBasic;
    }
  | {
      bindingId: string;
      authType: 'custom';
      headerValues: Record<string, string>;
      apply: AuthApplyCustom;
    }
  | {
      bindingId: string;
      authType: 'oauth2_cc';
      accessToken: string;
      apply: AuthApplyOAuth2Cc;
    };

export function isResolvedAuthType<T extends ManifestAuthType>(
  credential: ResolvedCredential,
  authType: T,
): credential is Extract<ResolvedCredential, { authType: T }> {
  return credential.authType === authType;
}
