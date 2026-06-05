import { describe, expect, it } from 'vitest';

import { isResolvedAuthType, type ResolvedCredential } from './resolved-credential.js';

const apiKeyCredential: ResolvedCredential = {
  bindingId: 'cb_key',
  authType: 'apiKey',
  value: 'secret',
  apply: { in: 'header', name: 'X-API-Key' },
};

const bearerCredential: ResolvedCredential = {
  bindingId: 'cb_bearer',
  authType: 'bearer',
  token: 'tok',
  apply: { headerName: 'Authorization', prefix: 'Bearer' },
};

describe('isResolvedAuthType', () => {
  it('narrows to the matching auth type', () => {
    expect(isResolvedAuthType(apiKeyCredential, 'apiKey')).toBe(true);
    if (isResolvedAuthType(apiKeyCredential, 'apiKey')) {
      expect(apiKeyCredential.value).toBe('secret');
    }

    expect(isResolvedAuthType(bearerCredential, 'bearer')).toBe(true);
    if (isResolvedAuthType(bearerCredential, 'bearer')) {
      expect(bearerCredential.token).toBe('tok');
    }
  });

  it('returns false for a non-matching auth type', () => {
    expect(isResolvedAuthType(apiKeyCredential, 'bearer')).toBe(false);
    expect(isResolvedAuthType(bearerCredential, 'apiKey')).toBe(false);
  });
});
