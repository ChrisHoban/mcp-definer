import type { HttpRequest } from '@mcp-definer/auth';
import type { Manifest, ManifestTool } from '@mcp-definer/schemas';

function encodeQueryValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeURIComponent(String(item))).join(',');
  }
  return encodeURIComponent(String(value));
}

function substitutePathParams(pathTemplate: string, args: Record<string, unknown>): string {
  return pathTemplate.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = args[name];
    if (value === undefined || value === null) {
      throw new Error(`Missing required path parameter: ${name}`);
    }
    return encodeURIComponent(String(value));
  });
}

function buildQueryParams(
  tool: ManifestTool,
  args: Record<string, unknown>,
): Record<string, string> | undefined {
  const query: Record<string, string> = {};

  for (const [name, mapping] of Object.entries(tool.request.paramMap)) {
    if (mapping.in !== 'query') {
      continue;
    }
    const value = args[name];
    if (value === undefined || value === null) {
      continue;
    }
    query[name] = encodeQueryValue(value);
  }

  return Object.keys(query).length > 0 ? query : undefined;
}

function buildHeaderParams(
  tool: ManifestTool,
  args: Record<string, unknown>,
): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const [name, mapping] of Object.entries(tool.request.paramMap)) {
    if (mapping.in !== 'header') {
      continue;
    }
    const value = args[name];
    if (value === undefined || value === null) {
      continue;
    }
    headers[name] = String(value);
  }

  return headers;
}

function buildBody(tool: ManifestTool, args: Record<string, unknown>): unknown {
  const bodyParam = tool.request.bodyParam;
  if (!bodyParam) {
    return undefined;
  }
  return args[bodyParam];
}

export function buildHttpRequest(
  manifest: Manifest,
  tool: ManifestTool,
  args: Record<string, unknown>,
  baseUrlOverride?: string,
): HttpRequest {
  const baseUrl = (baseUrlOverride ?? manifest.targetApi.baseUrl).replace(/\/$/, '');
  const path = substitutePathParams(tool.request.pathTemplate, args);
  const query = buildQueryParams(tool, args);
  const queryString =
    query && Object.keys(query).length > 0
      ? `?${Object.entries(query)
          .map(([key, value]) => `${encodeURIComponent(key)}=${value}`)
          .join('&')}`
      : '';

  return {
    method: tool.request.method,
    url: `${baseUrl}${path}${queryString}`,
    headers: {
      Accept: 'application/json',
      ...buildHeaderParams(tool, args),
    },
    query,
    body: buildBody(tool, args),
  };
}
