import type {
  IntermediateRepresentation,
  IrOperation,
  Manifest,
  ManifestTool,
} from '@mcp-definer/schemas';
import { MANIFEST_SCHEMA_VERSION, MCP_PROTOCOL_VERSION } from '@mcp-definer/schemas';

import { buildManifestAuth, defaultBindingId } from './auth-map.js';
import { manifestSpecType } from './openapi/detect.js';
import {
  buildInputSchema,
  isForbiddenInputName,
  mergeParameterProperties,
  normalizeJsonSchema,
} from './schema-merge.js';
import type { GeneratorWarning, MapIrOptions } from './types.js';
import { warn } from './warnings.js';

function pickSuccessStatuses(responses: IrOperation['responses']): string[] {
  const codes = responses
    .map((r) => r.status)
    .filter((s) => /^[0-9]{3}$/.test(s) && s.startsWith('2'));
  const unique = [...new Set(codes)].sort();
  return unique.length > 0 ? unique : ['200'];
}

function operationToTool(op: IrOperation, warnings: GeneratorWarning[]): ManifestTool {
  const params: Array<{
    in: 'path' | 'query' | 'header' | 'body';
    name: string;
    required: boolean;
    description?: string;
    schema: import('@mcp-definer/schemas').JsonSchema;
  }> = [];

  for (const p of op.parameters) {
    if (isForbiddenInputName(p.name)) {
      warnings.push(
        warn(
          'strippedSecretParam',
          `Removed forbidden parameter "${p.name}" from tool ${op.id}`,
          `/operations/${op.id}/parameters/${p.name}`,
        ),
      );
      continue;
    }
    params.push({
      in: p.in === 'cookie' ? 'header' : p.in,
      name: p.name,
      required: p.required,
      description: p.description,
      schema: p.schema,
    });
  }

  let bodyParam: string | null = null;
  if (op.requestBody?.schema) {
    const bodyName = 'body';
    params.push({
      in: 'body',
      name: bodyName,
      required: op.requestBody.required,
      schema: op.requestBody.schema,
    });
    bodyParam = bodyName;
  }

  const { properties, required } = mergeParameterProperties(
    params,
    warnings,
    `/operations/${op.id}`,
  );

  const inputSchema = buildInputSchema(properties, required, warnings);
  const inputProps = (inputSchema.properties ?? {}) as Record<string, unknown>;
  const requiredNames = new Set((inputSchema.required as string[] | undefined) ?? []);
  const paramMap: ManifestTool['request']['paramMap'] = {};
  for (const prop of properties) {
    if (prop.name in inputProps || requiredNames.has(prop.name)) {
      paramMap[prop.name] = { in: prop.in };
    }
  }

  const description = op.summary?.trim() || op.description?.trim() || `${op.method} ${op.path}`;

  return {
    name: op.id,
    description,
    enabled: true,
    inputSchema,
    request: {
      method: op.method,
      pathTemplate: op.path,
      paramMap,
      bodyParam,
    },
    response: {
      shape: 'passthrough',
      successStatus: pickSuccessStatuses(op.responses),
      errorMap: { default: 'raise' },
    },
    pagination: null,
    rateLimit: null,
  };
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'localhost';
  }
}

export function mapIrToManifest(
  ir: IntermediateRepresentation,
  options: MapIrOptions,
  warnings: GeneratorWarning[] = [],
): Manifest {
  const name = options.name;
  const baseUrl = ir.servers[0]?.url ?? 'http://localhost';
  const schemeName = options.securityScheme;
  const bindingId =
    options.authBindingId ?? defaultBindingId(name, pickSchemeSuffix(ir, schemeName));

  const tools = ir.operations
    .map((op) => operationToTool(op, warnings))
    .sort((a, b) => a.name.localeCompare(b.name));

  const displayName = options.displayName ?? ir.source.title ?? name;
  const description = options.description ?? `MCP for ${displayName}`;

  return {
    manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    mcpProtocolVersion: MCP_PROTOCOL_VERSION,
    name,
    displayName,
    description,
    targetApi: {
      specType: manifestSpecType(ir.source.type),
      specHash: ir.source.hash,
      baseUrl,
      baseUrlOverridable: true,
    },
    transport: {
      modes: ['stdio', 'http'],
      default: 'stdio',
    },
    auth: buildManifestAuth(ir, bindingId, schemeName),
    tools,
    resources: [],
    prompts: [],
    policies: {
      timeoutMs: 30000,
      retries: { max: 2, backoffMs: 200 },
      egressAllowlist: [hostFromUrl(baseUrl)],
    },
  };
}

function pickSchemeSuffix(ir: IntermediateRepresentation, preferred?: string): string {
  const schemes = Object.keys(ir.securitySchemes).sort();
  if (preferred && ir.securitySchemes[preferred]) {
    return preferred;
  }
  const apiKey = schemes.find((s) => ir.securitySchemes[s]?.type === 'apiKey');
  return apiKey ?? schemes[0] ?? 'default';
}

/** Deep-merge input schema override patches deterministically. */
export function patchInputSchema(
  base: import('@mcp-definer/schemas').JsonSchema,
  override: import('@mcp-definer/schemas').JsonSchema,
  warnings: GeneratorWarning[],
  path: string,
): import('@mcp-definer/schemas').JsonSchema {
  const merged = {
    ...base,
    ...override,
    properties: {
      ...((base.properties as Record<string, unknown>) ?? {}),
      ...((override.properties as Record<string, unknown>) ?? {}),
    },
  };
  return normalizeJsonSchema(merged, warnings, path);
}
