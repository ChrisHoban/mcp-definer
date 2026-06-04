import type { JsonSchema } from '@mcp-definer/schemas';

import type { GeneratorWarning } from './types.js';
import { warn } from './warnings.js';

const PERMISSIVE_OBJECT: JsonSchema = { type: 'object', additionalProperties: true };

/** Property names that must not appear in Manifest inputSchema (ADR-004). */
export const FORBIDDEN_INPUT_KEYS = new Set([
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

export function isForbiddenInputName(name: string): boolean {
  return FORBIDDEN_INPUT_KEYS.has(name);
}

function stripForbiddenKeys(
  schema: JsonSchema,
  warnings: GeneratorWarning[],
  path: string,
): JsonSchema {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return schema;
  }

  const result: JsonSchema = { ...schema };

  if (result.properties && typeof result.properties === 'object') {
    const props: Record<string, JsonSchema> = {};
    for (const [key, value] of Object.entries(result.properties as Record<string, JsonSchema>)) {
      if (FORBIDDEN_INPUT_KEYS.has(key)) {
        warnings.push(
          warn(
            'strippedSecretField',
            `Removed forbidden input property "${key}" from generated inputSchema`,
            `${path}/properties/${key}`,
          ),
        );
        continue;
      }
      props[key] = stripForbiddenKeys(value, warnings, `${path}/properties/${key}`);
    }
    result.properties = props;
  }

  if (result.items) {
    result.items = stripForbiddenKeys(result.items as JsonSchema, warnings, `${path}/items`);
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = stripForbiddenKeys(
      result.additionalProperties as JsonSchema,
      warnings,
      `${path}/additionalProperties`,
    );
  }

  return result;
}

/** Flatten unsupported combinators to a permissive object (MVP exclusion). */
export function normalizeJsonSchema(
  schema: unknown,
  warnings: GeneratorWarning[],
  path: string,
): JsonSchema {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return PERMISSIVE_OBJECT;
  }

  const record = schema as Record<string, unknown>;

  if ('oneOf' in record || 'anyOf' in record || 'allOf' in record) {
    warnings.push(
      warn('unsupportedCombinator', 'oneOf/anyOf/allOf flattened to generic object (MVP)', path),
    );
    const branches = (record.oneOf ?? record.anyOf ?? record.allOf) as unknown[];
    if (Array.isArray(branches) && branches.length > 0) {
      return normalizeJsonSchema(branches[0], warnings, path);
    }
    return PERMISSIVE_OBJECT;
  }

  if ('$ref' in record) {
    warnings.push(warn('unresolvedRef', 'Unresolved $ref replaced with generic object', path));
    return PERMISSIVE_OBJECT;
  }

  const result: JsonSchema = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === 'nullable' && value === true) {
      continue;
    }
    if (key === 'properties' && value && typeof value === 'object' && !Array.isArray(value)) {
      const props: Record<string, JsonSchema> = {};
      for (const [propName, propSchema] of Object.entries(value as Record<string, unknown>)) {
        props[propName] = normalizeJsonSchema(
          propSchema,
          warnings,
          `${path}/properties/${propName}`,
        );
      }
      result.properties = props;
      continue;
    }
    if (key === 'items') {
      result.items = normalizeJsonSchema(value, warnings, `${path}/items`);
      continue;
    }
    if (key === 'additionalProperties' && typeof value === 'object') {
      result.additionalProperties = normalizeJsonSchema(
        value,
        warnings,
        `${path}/additionalProperties`,
      );
      continue;
    }
    result[key] = value;
  }

  if (!('type' in result) && !('properties' in result)) {
    if ('enum' in result) {
      result.type = 'string';
    } else {
      result.type = 'object';
      result.additionalProperties = true;
    }
  }

  return stripForbiddenKeys(result, warnings, path);
}

export interface MergedParamProperty {
  /** Property name in inputSchema / paramMap. */
  name: string;
  in: 'path' | 'query' | 'header' | 'body';
  required: boolean;
  description?: string;
  schema: JsonSchema;
}

const LOCATION_SUFFIX: Record<string, string> = {
  path: '_path',
  query: '_query',
  header: '_header',
};

/**
 * Merge parameters into inputSchema properties with deterministic collision suffixes.
 * Priority when resolving bare name: path < query < header < body (later wins suffix).
 */
export function mergeParameterProperties(
  params: Array<{
    in: 'path' | 'query' | 'header' | 'body';
    name: string;
    required: boolean;
    description?: string;
    schema: JsonSchema;
  }>,
  warnings: GeneratorWarning[],
  path: string,
): { properties: MergedParamProperty[]; required: string[] } {
  const byKey = new Map<string, MergedParamProperty>();
  const order: string[] = [];

  const priority: Record<string, number> = { path: 0, query: 1, header: 2, body: 3 };

  for (const param of params) {
    let key = param.name;
    const existing = byKey.get(key);
    if (existing && existing.in !== param.in) {
      key = `${param.name}${LOCATION_SUFFIX[param.in]}`;
      warnings.push(
        warn(
          'paramNameCollision',
          `Parameter name "${param.name}" collides across locations; using "${key}"`,
          `${path}/${key}`,
        ),
      );
    } else if (existing) {
      key = `${param.name}${LOCATION_SUFFIX[param.in]}`;
    }

    const entry: MergedParamProperty = {
      name: key,
      in: param.in,
      required: param.required,
      description: param.description,
      schema: normalizeJsonSchema(param.schema, warnings, `${path}/${key}`),
    };

    if (!byKey.has(key)) {
      order.push(key);
    }
    byKey.set(key, entry);
  }

  // Stable order: path params first (path template order), then query, header, body
  const sorted = order.sort((a, b) => {
    const pa = byKey.get(a)!;
    const pb = byKey.get(b)!;
    const d = priority[pa.in] - priority[pb.in];
    if (d !== 0) {
      return d;
    }
    return a.localeCompare(b);
  });

  const properties = sorted.map((k) => byKey.get(k)!);
  const required = properties.filter((p) => p.required).map((p) => p.name);

  return { properties, required };
}

export function buildInputSchema(
  properties: MergedParamProperty[],
  required: string[],
  warnings: GeneratorWarning[] = [],
): JsonSchema {
  const schemaProperties: Record<string, JsonSchema> = {};
  for (const prop of properties) {
    const field: JsonSchema = { ...prop.schema };
    if (prop.description) {
      field.description = prop.description;
    }
    schemaProperties[prop.name] = field;
  }

  const schema: JsonSchema = {
    type: 'object',
    properties: schemaProperties,
  };

  const filteredRequired = required.filter((name) => properties.some((p) => p.name === name));
  if (filteredRequired.length > 0) {
    schema.required = [...filteredRequired].sort();
  }

  return stripForbiddenKeys(schema, warnings, '/inputSchema');
}
