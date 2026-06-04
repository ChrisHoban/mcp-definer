import type {
  HttpMethod,
  IntermediateRepresentation,
  IrOperation,
  IrParameter,
  IrResponse,
  IrSecurityScheme,
  IrSourceType,
  JsonSchema,
} from '@mcp-definer/schemas';
import { IR_VERSION } from '@mcp-definer/schemas';

import { sha256SpecHash } from '../hash.js';
import { assignStableOperationIds, normalizeHttpMethod } from '../operation-id.js';
import { normalizeJsonSchema } from '../schema-merge.js';
import type { GeneratorWarning } from '../types.js';
import { warn } from '../warnings.js';
import { detectSpecFormat } from './detect.js';

interface RawOperation {
  method: HttpMethod;
  path: string;
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters: IrParameter[];
  requestBody?: IrOperation['requestBody'];
  responses: IrResponse[];
  security?: string[];
}

function swagger2TypeToSchema(param: Record<string, unknown>): JsonSchema {
  const schema: JsonSchema = {};
  if (param.type) {
    schema.type = param.type as string;
  }
  if (param.format) {
    schema.format = param.format as string;
  }
  if (param.enum) {
    schema.enum = param.enum as unknown[];
  }
  if (param.items) {
    schema.items = swagger2TypeToSchema(param.items as Record<string, unknown>);
  }
  if (param.default !== undefined) {
    schema.default = param.default;
  }
  if (param.minimum !== undefined) {
    schema.minimum = param.minimum as number;
  }
  if (param.maximum !== undefined) {
    schema.maximum = param.maximum as number;
  }
  if (!('type' in schema)) {
    schema.type = 'string';
  }
  return schema;
}

function extractResponses(
  responses: Record<string, unknown> | undefined,
  warnings: GeneratorWarning[],
  opPath: string,
): IrResponse[] {
  if (!responses) {
    return [{ status: '200' }];
  }

  const result: IrResponse[] = [];
  for (const [status, value] of Object.entries(responses).sort(([a], [b]) => a.localeCompare(b))) {
    const resp = value as Record<string, unknown>;
    const description = typeof resp.description === 'string' ? resp.description : undefined;

    if (status === 'default') {
      if (!result.some((r) => r.status === '200')) {
        result.push({ status: '200', description });
      }
      continue;
    }

    if (!/^\d{3}$/.test(status)) {
      continue;
    }

    let contentType: string | undefined;
    let schema: JsonSchema | undefined;

    if (resp.schema) {
      schema = normalizeJsonSchema(resp.schema, warnings, `${opPath}/responses/${status}`);
    } else if (resp.content && typeof resp.content === 'object') {
      const content = resp.content as Record<string, Record<string, unknown>>;
      const mime = Object.keys(content).sort()[0];
      if (mime?.includes('multipart') || mime?.includes('octet-stream')) {
        warnings.push(
          warn('unsupportedBody', `Binary/multipart response skipped for ${opPath}`, opPath),
        );
      } else {
        contentType = mime;
        const media = content[mime];
        if (media?.schema) {
          schema = normalizeJsonSchema(media.schema, warnings, `${opPath}/responses/${status}`);
        }
      }
    }

    result.push({ status, description, contentType, schema });
  }

  return result.length > 0 ? result : [{ status: '200' }];
}

function parseSwagger2Operations(
  api: Record<string, unknown>,
  warnings: GeneratorWarning[],
): RawOperation[] {
  const paths = (api.paths ?? {}) as Record<string, Record<string, unknown>>;
  const raw: Array<RawOperation & { operationId?: string }> = [];

  const pathKeys = Object.keys(paths).sort();

  for (const path of pathKeys) {
    const pathItem = paths[path]!;
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].sort()) {
      const op = pathItem[method] as Record<string, unknown> | undefined;
      if (!op) {
        continue;
      }

      const httpMethod = normalizeHttpMethod(method);
      if (!httpMethod) {
        continue;
      }

      const parameters: IrParameter[] = [];
      let requestBody: IrOperation['requestBody'] | undefined;

      const opParams = (op.parameters ?? []) as Record<string, unknown>[];
      for (const param of opParams) {
        const loc = param.in as string;
        if (loc === 'formData') {
          warnings.push(
            warn('unsupportedFormData', `formData parameter ignored on ${httpMethod} ${path}`, path),
          );
          continue;
        }
        if (loc === 'body') {
          requestBody = {
            required: Boolean(param.required),
            contentType: 'application/json',
            schema: normalizeJsonSchema(
              param.schema ?? { type: 'object' },
              warnings,
              `${path}/body`,
            ),
          };
          continue;
        }
        if (loc === 'path' || loc === 'query' || loc === 'header' || loc === 'cookie') {
          parameters.push({
            in: loc,
            name: String(param.name),
            required: Boolean(param.required),
            description: typeof param.description === 'string' ? param.description : undefined,
            schema: swagger2TypeToSchema(param),
          });
        }
      }

      const consumes = (op.consumes ?? api.consumes) as string[] | undefined;
      if (consumes?.some((c) => c.includes('multipart'))) {
        warnings.push(warn('unsupportedMultipart', `multipart upload on ${httpMethod} ${path}`, path));
      }

      raw.push({
        method: httpMethod,
        path,
        operationId: typeof op.operationId === 'string' ? op.operationId : undefined,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
        description: typeof op.description === 'string' ? op.description : undefined,
        tags: Array.isArray(op.tags) ? (op.tags as string[]) : undefined,
        parameters,
        requestBody,
        responses: extractResponses(op.responses as Record<string, unknown>, warnings, path),
        security: extractSecurityNames(op.security ?? api.security),
      });
    }
  }

  return assignIdsToRaw(raw);
}

function parseOpenApi3Operations(
  api: Record<string, unknown>,
  warnings: GeneratorWarning[],
): RawOperation[] {
  const paths = (api.paths ?? {}) as Record<string, Record<string, unknown>>;
  const raw: RawOperation[] = [];

  for (const path of Object.keys(paths).sort()) {
    const pathItem = paths[path]!;
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].sort()) {
      const op = pathItem[method] as Record<string, unknown> | undefined;
      if (!op) {
        continue;
      }

      const httpMethod = normalizeHttpMethod(method);
      if (!httpMethod) {
        continue;
      }

      const parameters: IrParameter[] = [];
      const opParams = [
        ...((pathItem.parameters ?? []) as Record<string, unknown>[]),
        ...((op.parameters ?? []) as Record<string, unknown>[]),
      ];

      for (const param of opParams) {
        const loc = param.in as string;
        if (loc === 'path' || loc === 'query' || loc === 'header' || loc === 'cookie') {
          parameters.push({
            in: loc,
            name: String(param.name),
            required: Boolean(param.required),
            description: typeof param.description === 'string' ? param.description : undefined,
            schema: normalizeJsonSchema(
              param.schema ?? { type: 'string' },
              warnings,
              `${path}/${param.name}`,
            ),
          });
        }
      }

      let requestBody: IrOperation['requestBody'] | undefined;
      if (op.requestBody) {
        const rb = op.requestBody as Record<string, unknown>;
        const content = rb.content as Record<string, Record<string, unknown>> | undefined;
        const mime = content ? Object.keys(content).sort()[0] : undefined;
        if (mime?.includes('multipart')) {
          warnings.push(warn('unsupportedMultipart', `multipart body on ${httpMethod} ${path}`, path));
        } else {
          const media = mime && content ? content[mime] : undefined;
          requestBody = {
            required: Boolean(rb.required),
            contentType: mime,
            schema: media?.schema
              ? normalizeJsonSchema(media.schema, warnings, `${path}/requestBody`)
              : { type: 'object', additionalProperties: true },
          };
        }
      }

      raw.push({
        method: httpMethod,
        path,
        operationId: typeof op.operationId === 'string' ? op.operationId : undefined,
        summary: typeof op.summary === 'string' ? op.summary : undefined,
        description: typeof op.description === 'string' ? op.description : undefined,
        tags: Array.isArray(op.tags) ? (op.tags as string[]) : undefined,
        parameters,
        requestBody,
        responses: extractResponses(op.responses as Record<string, unknown>, warnings, path),
        security: extractSecurityNames(op.security ?? api.security),
      });
    }
  }

  return assignIdsToRaw(raw);
}

function extractSecurityNames(
  security: unknown,
): string[] | undefined {
  if (!Array.isArray(security) || security.length === 0) {
    return undefined;
  }
  const first = security[0] as Record<string, unknown>;
  return Object.keys(first).sort();
}

function assignIdsToRaw(raw: Array<RawOperation & { operationId?: string }>): RawOperation[] {
  const ids = assignStableOperationIds(raw);
  return raw.map((op, index) => ({
    ...op,
    operationId: ids[index],
  })) as RawOperation[];
}

function parseSwagger2Security(
  definitions: Record<string, unknown> | undefined,
): Record<string, IrSecurityScheme> {
  const result: Record<string, IrSecurityScheme> = {};
  if (!definitions) {
    return result;
  }

  for (const [name, def] of Object.entries(definitions).sort(([a], [b]) => a.localeCompare(b))) {
    const scheme = def as Record<string, unknown>;
    const type = scheme.type as string;
    if (type === 'apiKey') {
      result[name] = {
        type: 'apiKey',
        in: scheme.in as 'header' | 'query',
        name: scheme.name as string,
      };
    } else if (type === 'basic') {
      result[name] = { type: 'http', scheme: 'basic' };
    } else if (type === 'oauth2') {
      const flow = scheme.flow as string;
      const flows: Record<string, unknown> = {};
      if (flow === 'implicit') {
        flows.implicit = {
          authorizationUrl: scheme.authorizationUrl,
          scopes: scheme.scopes,
        };
      } else if (flow === 'accessCode') {
        flows.authorizationCode = {
          authorizationUrl: scheme.authorizationUrl,
          tokenUrl: scheme.tokenUrl,
          scopes: scheme.scopes,
        };
      } else if (flow === 'password') {
        flows.password = {
          tokenUrl: scheme.tokenUrl,
          scopes: scheme.scopes,
        };
      } else if (flow === 'application') {
        flows.clientCredentials = {
          tokenUrl: scheme.tokenUrl,
          scopes: scheme.scopes,
        };
      }
      result[name] = { type: 'oauth2', flows };
    }
  }

  return result;
}

function parseOpenApi3Security(
  schemes: Record<string, unknown> | undefined,
): Record<string, IrSecurityScheme> {
  const result: Record<string, IrSecurityScheme> = {};
  if (!schemes) {
    return result;
  }

  for (const [name, def] of Object.entries(schemes).sort(([a], [b]) => a.localeCompare(b))) {
    const scheme = def as Record<string, unknown>;
    const type = scheme.type as string;
    if (type === 'apiKey') {
      result[name] = {
        type: 'apiKey',
        in: scheme.in as 'header' | 'query' | 'cookie',
        name: scheme.name as string,
      };
    } else if (type === 'http') {
      result[name] = {
        type: 'http',
        scheme: scheme.scheme as string,
        bearerFormat: scheme.bearerFormat as string | undefined,
      };
    } else if (type === 'oauth2') {
      result[name] = { type: 'oauth2', flows: scheme.flows as Record<string, unknown> };
    } else if (type === 'openIdConnect') {
      result[name] = {
        type: 'openIdConnect',
        openIdConnectUrl: scheme.openIdConnectUrl as string,
      };
    }
  }

  return result;
}

function resolveServerUrl(api: Record<string, unknown>, format: IrSourceType): string {
  if (format === 'swagger2') {
    const schemes = (api.schemes as string[] | undefined) ?? ['https'];
    const scheme = schemes[0] ?? 'https';
    const host = (api.host as string | undefined) ?? 'localhost';
    const basePath = (api.basePath as string | undefined) ?? '';
    return `${scheme}://${host}${basePath}`;
  }

  const servers = api.servers as Array<{ url: string }> | undefined;
  if (servers && servers.length > 1) {
    // MVP: first server only — warning emitted by caller
  }
  if (servers?.[0]?.url) {
    return servers[0].url;
  }

  return 'http://localhost';
}

export function buildIrFromOpenApi(
  api: Record<string, unknown>,
  specText: string,
  warnings: GeneratorWarning[],
): IntermediateRepresentation {
  const format = detectSpecFormat(api);
  const info = (api.info ?? {}) as Record<string, unknown>;

  if (format === 'swagger2' && Array.isArray(api.servers) && (api.servers as unknown[]).length > 1) {
    warnings.push(warn('multipleServers', 'Multiple servers found; using first only (MVP)', '/servers'));
  }

  const operations =
    format === 'swagger2'
      ? parseSwagger2Operations(api, warnings)
      : parseOpenApi3Operations(api, warnings);

  const securitySchemes =
    format === 'swagger2'
      ? parseSwagger2Security(api.securityDefinitions as Record<string, unknown>)
      : parseOpenApi3Security(
          ((api.components as Record<string, unknown> | undefined)?.securitySchemes ??
            {}) as Record<string, unknown>,
        );

  const irOperations: IrOperation[] = operations
    .map((op) => ({
      id: op.operationId!,
      method: op.method,
      path: op.path,
      summary: op.summary,
      description: op.description,
      tags: op.tags,
      parameters: op.parameters,
      requestBody: op.requestBody,
      responses: op.responses,
      security: op.security,
    }))
    .sort((a, b) => {
      const pathCmp = a.path.localeCompare(b.path);
      if (pathCmp !== 0) {
        return pathCmp;
      }
      return a.method.localeCompare(b.method);
    });

  return {
    irVersion: IR_VERSION,
    source: {
      type: format,
      hash: sha256SpecHash(specText),
      title: typeof info.title === 'string' ? info.title : undefined,
      version: typeof info.version === 'string' ? info.version : undefined,
    },
    servers: [{ url: resolveServerUrl(api, format) }],
    operations: irOperations,
    securitySchemes,
  };
}
