import type { IntermediateRepresentation } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import {
  buildManifestAuth,
  defaultBindingId,
  pickPrimarySecuritySchemeName,
} from './auth-map.js';

const IR_BASE: IntermediateRepresentation = {
  irVersion: '1.0',
  source: {
    type: 'openapi3',
    hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
  },
  servers: [{ url: 'https://petstore.swagger.io/v2' }],
  operations: [],
  securitySchemes: {},
};

describe('pickPrimarySecuritySchemeName', () => {
  it('returns undefined when no schemes exist', () => {
    expect(pickPrimarySecuritySchemeName(IR_BASE)).toBeUndefined();
  });

  it('prefers apiKey scheme over bearer', () => {
    const ir: IntermediateRepresentation = {
      ...IR_BASE,
      securitySchemes: {
        bearer_auth: { type: 'http', scheme: 'bearer' },
        api_key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
    };
    expect(pickPrimarySecuritySchemeName(ir)).toBe('api_key');
  });

  it('honors explicit preferred scheme name', () => {
    const ir: IntermediateRepresentation = {
      ...IR_BASE,
      securitySchemes: {
        api_key: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        oauth: { type: 'oauth2', flows: { clientCredentials: { tokenUrl: 'https://t/o' } } },
      },
    };
    expect(pickPrimarySecuritySchemeName(ir, 'oauth')).toBe('oauth');
  });
});

describe('buildManifestAuth', () => {
  it('defaults to apiKey when IR has no security schemes', () => {
    const auth = buildManifestAuth(IR_BASE, 'cb_petstore');
    expect(auth).toEqual({
      bindingId: 'cb_petstore',
      type: 'apiKey',
      apply: { in: 'header', name: 'X-API-Key' },
    });
  });

  it('maps http basic to basic auth type', () => {
    const ir: IntermediateRepresentation = {
      ...IR_BASE,
      securitySchemes: {
        basic: { type: 'http', scheme: 'basic' },
      },
    };
    const auth = buildManifestAuth(ir, 'cb_basic', 'basic');
    expect(auth.type).toBe('basic');
    expect(auth.apply).toEqual({});
  });

  it('maps oauth2 client credentials flow', () => {
    const ir: IntermediateRepresentation = {
      ...IR_BASE,
      securitySchemes: {
        oauth: {
          type: 'oauth2',
          flows: {
            clientCredentials: {
              tokenUrl: 'https://auth.example.com/token',
              scopes: { read: 'Read access' },
            },
          },
        },
      },
    };
    const auth = buildManifestAuth(ir, 'cb_oauth', 'oauth');
    expect(auth.type).toBe('oauth2_cc');
    expect(auth.apply).toMatchObject({
      tokenUrl: 'https://auth.example.com/token',
      scopes: ['read'],
    });
  });

  it('maps oauth2 authorization code flow', () => {
    const ir: IntermediateRepresentation = {
      ...IR_BASE,
      securitySchemes: {
        oauth: {
          type: 'oauth2',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://auth.example.com/authorize',
              tokenUrl: 'https://auth.example.com/token',
            },
          },
        },
      },
    };
    const auth = buildManifestAuth(ir, 'cb_ac', 'oauth');
    expect(auth.type).toBe('oauth2_ac');
    expect(auth.apply).toMatchObject({
      authorizationUrl: 'https://auth.example.com/authorize',
      tokenUrl: 'https://auth.example.com/token',
    });
  });
});

describe('defaultBindingId', () => {
  it('sanitizes scheme name into binding suffix', () => {
    expect(defaultBindingId('petstore', 'api-key')).toBe('cb_petstore_api_key');
    expect(defaultBindingId('petstore')).toBe('cb_petstore_default');
  });
});
