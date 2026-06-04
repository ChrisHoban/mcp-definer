import type {
  AuthApply,
  IntermediateRepresentation,
  IrSecurityScheme,
  ManifestAuth,
  ManifestAuthType,
} from '@mcp-definer/schemas';

export function pickPrimarySecuritySchemeName(
  ir: IntermediateRepresentation,
  preferred?: string,
): string | undefined {
  const names = Object.keys(ir.securitySchemes).sort();
  if (names.length === 0) {
    return undefined;
  }

  if (preferred && ir.securitySchemes[preferred]) {
    return preferred;
  }

  const apiKey = names.find((n) => ir.securitySchemes[n]?.type === 'apiKey');
  if (apiKey) {
    return apiKey;
  }

  return names[0];
}

function mapSchemeType(scheme: IrSecurityScheme): ManifestAuthType {
  if (scheme.type === 'apiKey') {
    return 'apiKey';
  }
  if (scheme.type === 'http') {
    const httpScheme = (scheme.scheme ?? 'bearer').toLowerCase();
    if (httpScheme === 'basic') {
      return 'basic';
    }
    return 'bearer';
  }
  if (scheme.type === 'oauth2') {
    const flows = scheme.flows ?? {};
    if ('clientCredentials' in flows) {
      return 'oauth2_cc';
    }
    if ('authorizationCode' in flows) {
      return 'oauth2_ac';
    }
    // Swagger 2 implicit/password → treat as authorization code style for MVP
    if ('implicit' in flows || 'password' in flows) {
      return 'oauth2_ac';
    }
    return 'oauth2_cc';
  }
  return 'custom';
}

function mapSchemeApply(
  scheme: IrSecurityScheme,
  authType: ManifestAuthType,
): AuthApply {
  switch (authType) {
    case 'apiKey':
      return {
        in: scheme.in === 'query' ? 'query' : 'header',
        name: scheme.name ?? 'X-API-Key',
      };
    case 'bearer':
      return {
        headerName: 'Authorization',
        prefix: scheme.scheme === 'bearer' ? 'Bearer' : scheme.scheme ?? 'Bearer',
      };
    case 'oauth2_cc': {
      const flow = (scheme.flows?.clientCredentials ?? scheme.flows?.client_credentials) as
        | { tokenUrl?: string; scopes?: string[] }
        | undefined;
      return {
        tokenUrl: flow?.tokenUrl ?? 'https://example.com/oauth/token',
        scopes: flow?.scopes ? Object.keys(flow.scopes) : undefined,
      };
    }
    case 'oauth2_ac': {
      const flow = (scheme.flows?.authorizationCode ??
        scheme.flows?.implicit ??
        scheme.flows?.password) as
        | { authorizationUrl?: string; tokenUrl?: string; scopes?: string[] }
        | undefined;
      return {
        authorizationUrl: flow?.authorizationUrl ?? 'https://example.com/oauth/authorize',
        tokenUrl: flow?.tokenUrl ?? 'https://example.com/oauth/token',
        scopes: flow?.scopes ? Object.keys(flow.scopes) : undefined,
      };
    }
    case 'basic':
      return {};
    case 'custom':
    default:
      return { headers: { Authorization: 'Bearer <token>' } };
  }
}

export function buildManifestAuth(
  ir: IntermediateRepresentation,
  bindingId: string,
  schemeName?: string,
): ManifestAuth {
  const name = pickPrimarySecuritySchemeName(ir, schemeName);
  if (!name) {
    return {
      bindingId,
      type: 'apiKey',
      apply: { in: 'header', name: 'X-API-Key' },
    };
  }

  const scheme = ir.securitySchemes[name]!;
  const type = mapSchemeType(scheme);
  return {
    bindingId,
    type,
    apply: mapSchemeApply(scheme, type),
  };
}

export function defaultBindingId(mcpName: string, schemeName?: string): string {
  const suffix = schemeName?.replace(/[^a-zA-Z0-9_]/g, '_') ?? 'default';
  return `cb_${mcpName}_${suffix}`;
}
