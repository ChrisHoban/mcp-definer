import type { HttpMethod } from '@mcp-definer/schemas';

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_PREFIX: Record<HttpMethod, string> = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete',
  HEAD: 'head',
  OPTIONS: 'options',
};

/** Identifier-safe MCP tool name (matches manifest schema pattern). */
export function sanitizeToolName(raw: string): string {
  let name = raw.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!/^[a-zA-Z]/.test(name)) {
    name = `op_${name}`;
  }
  return name;
}

function segmentToCamel(segment: string): string {
  const cleaned = segment.replace(/[{}]/g, '');
  if (!cleaned) {
    return '';
  }
  const parts = cleaned.split(/[-_./]+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      if (index === 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/** Derive stable operation id from HTTP method + path when operationId is missing. */
export function deriveOperationId(method: HttpMethod, path: string): string {
  const prefix = METHOD_PREFIX[method];
  const segments = path.split('/').filter((s) => s.length > 0);
  const tail = segments.map(segmentToCamel).join('');
  const base = `${prefix}${tail.charAt(0).toUpperCase()}${tail.slice(1)}`;
  return sanitizeToolName(base);
}

/** Assign collision-free operation ids in stable path→method order. */
export function assignStableOperationIds(
  ops: Array<{ method: HttpMethod; path: string; operationId?: string }>,
): string[] {
  const seen = new Map<string, number>();
  const ids: string[] = [];

  for (const op of ops) {
    const base = sanitizeToolName(op.operationId?.trim() || deriveOperationId(op.method, op.path));
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    ids.push(count === 0 ? base : `${base}_${count + 1}`);
  }

  return ids;
}

export function isHttpMethod(value: string): value is HttpMethod {
  return (HTTP_METHODS as string[]).includes(value);
}

export function normalizeHttpMethod(value: string): HttpMethod | undefined {
  const upper = value.toUpperCase();
  return isHttpMethod(upper) ? upper : undefined;
}
