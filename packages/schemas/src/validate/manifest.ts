import type { ErrorObject, ValidateFunction } from 'ajv';

import type { Manifest, ManifestAuthType, ManifestTool } from '../types/manifest.js';
import type { ValidateManifestResult, ValidationIssue } from '../types/validation.js';
import { getAjv, manifestSchema } from './ajv.js';

const FORBIDDEN_SECRET_KEYS = new Set([
  'secret',
  'password',
  'clientSecret',
  'client_secret',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKeyValue',
  'api_key_value',
  'tokenValue',
  'token_value',
  'credential',
  'credentials',
]);

const SECRET_VALUE_PATTERNS = [/^sk-[a-zA-Z0-9]{20,}$/, /^Bearer\s+[a-zA-Z0-9._-]{20,}$/i];

function ajvErrorsToIssues(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  if (!errors) {
    return [];
  }

  return errors.map((error) => ({
    path: error.instancePath || '/',
    message: error.message ?? 'Validation failed',
    code: error.keyword,
  }));
}

function collectSecretViolations(value: unknown, path = ''): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && path !== '/auth/bindingId') {
      for (const pattern of SECRET_VALUE_PATTERNS) {
        if (pattern.test(value)) {
          issues.push({
            path,
            message: 'Value appears to contain a secret credential',
            code: 'secretValue',
          });
          break;
        }
      }
    }
    return issues;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      issues.push(...collectSecretViolations(item, `${path}/${index}`));
    });
    return issues;
  }

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const childPath = `${path}/${key}`;
    if (FORBIDDEN_SECRET_KEYS.has(key)) {
      issues.push({
        path: childPath,
        message: `Forbidden secret field "${key}" — use auth.bindingId and secret_ref instead (ADR-004)`,
        code: 'forbiddenSecretField',
      });
    }
    issues.push(...collectSecretViolations(child, childPath));
  }

  return issues;
}

function authApplyMatchesType(
  authType: ManifestAuthType,
  apply: Record<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const path = '/auth/apply';

  switch (authType) {
    case 'apiKey':
      if (!('in' in apply) || !('name' in apply)) {
        issues.push({
          path,
          message: 'apiKey auth requires apply.in and apply.name',
          code: 'authApplyMismatch',
        });
      }
      break;
    case 'bearer':
      break;
    case 'oauth2_cc':
      if (typeof apply.tokenUrl !== 'string') {
        issues.push({
          path,
          message: 'oauth2_cc auth requires apply.tokenUrl',
          code: 'authApplyMismatch',
        });
      }
      break;
    case 'oauth2_ac':
      if (typeof apply.authorizationUrl !== 'string' || typeof apply.tokenUrl !== 'string') {
        issues.push({
          path,
          message: 'oauth2_ac auth requires apply.authorizationUrl and apply.tokenUrl',
          code: 'authApplyMismatch',
        });
      }
      break;
    case 'basic':
      break;
    case 'custom':
      if (!apply.headers || typeof apply.headers !== 'object') {
        issues.push({
          path,
          message: 'custom auth requires apply.headers',
          code: 'authApplyMismatch',
        });
      }
      break;
    default:
      break;
  }

  return issues;
}

function validateToolInputSchemas(
  tools: ManifestTool[],
  ajv: ReturnType<typeof getAjv>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  tools.forEach((tool, index) => {
    try {
      ajv.compile(tool.inputSchema);
    } catch (error) {
      issues.push({
        path: `/tools/${index}/inputSchema`,
        message:
          error instanceof Error ? error.message : 'Invalid JSON Schema for tool inputSchema',
        code: 'invalidInputSchema',
      });
    }
  });

  return issues;
}

function validateTransportConsistency(manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { modes, default: defaultMode } = manifest.transport;

  if (!modes.includes(defaultMode)) {
    issues.push({
      path: '/transport/default',
      message: 'transport.default must be one of transport.modes',
      code: 'transportDefault',
    });
  }

  return issues;
}

function validateUniqueToolNames(tools: ManifestTool[]): ValidationIssue[] {
  const seen = new Set<string>();
  const issues: ValidationIssue[] = [];

  tools.forEach((tool, index) => {
    if (seen.has(tool.name)) {
      issues.push({
        path: `/tools/${index}/name`,
        message: `Duplicate tool name "${tool.name}"`,
        code: 'duplicateToolName',
      });
    }
    seen.add(tool.name);
  });

  return issues;
}

function validateEgressAllowlist(manifest: Manifest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  let baseHost: string | undefined;

  try {
    baseHost = new URL(manifest.targetApi.baseUrl).hostname;
  } catch {
    return issues;
  }

  if (baseHost && !manifest.policies.egressAllowlist.includes(baseHost)) {
    issues.push({
      path: '/policies/egressAllowlist',
      message: `egressAllowlist must include target API host "${baseHost}" (NFR-03)`,
      code: 'egressAllowlist',
    });
  }

  return issues;
}

let manifestValidator: ValidateFunction | undefined;

function getManifestValidator(): ValidateFunction {
  const ajv = getAjv();
  if (!manifestValidator) {
    manifestValidator = ajv.getSchema(manifestSchema.$id!) ?? ajv.compile(manifestSchema);
  }
  return manifestValidator;
}

export function validateManifest(input: unknown): ValidateManifestResult {
  const ajv = getAjv();
  const validate = getManifestValidator();
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // ADR-004: scan for secrets even when structural schema fails
  if (input !== null && typeof input === 'object') {
    errors.push(...collectSecretViolations(input));
  }

  const schemaValid = validate(input);

  if (!schemaValid) {
    errors.push(...ajvErrorsToIssues(validate.errors));
    return {
      valid: false,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  const manifest = input as Manifest;

  errors.push(
    ...authApplyMatchesType(manifest.auth.type, manifest.auth.apply as Record<string, unknown>),
  );
  errors.push(...validateTransportConsistency(manifest));
  errors.push(...validateUniqueToolNames(manifest.tools));
  errors.push(...validateEgressAllowlist(manifest));
  errors.push(...validateToolInputSchemas(manifest.tools, ajv));

  if (manifest.tools.length === 0) {
    warnings.push({
      path: '/tools',
      message: 'Manifest has no tools',
      code: 'emptyTools',
    });
  }

  const disabledCount = manifest.tools.filter((t) => !t.enabled).length;
  if (disabledCount > 0) {
    warnings.push({
      path: '/tools',
      message: `${disabledCount} tool(s) are disabled`,
      code: 'disabledTools',
    });
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export function assertManifest(input: unknown): Manifest {
  const result = validateManifest(input);
  if (!result.valid) {
    const message =
      result.errors?.map((e) => `${e.path}: ${e.message}`).join('; ') ?? 'Invalid manifest';
    throw new Error(message);
  }
  return input as Manifest;
}
