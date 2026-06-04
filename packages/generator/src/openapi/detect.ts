import type { IrSourceType } from '@mcp-definer/schemas';

export function detectSpecFormat(doc: Record<string, unknown>): IrSourceType {
  if (typeof doc.swagger === 'string' && doc.swagger.startsWith('2')) {
    return 'swagger2';
  }

  const openapi = doc.openapi;
  if (typeof openapi === 'string') {
    if (openapi.startsWith('3.1')) {
      return 'openapi31';
    }
    return 'openapi3';
  }

  throw new Error('Unrecognized API spec format (expected OpenAPI 3.x or Swagger 2.0)');
}

export function manifestSpecType(
  sourceType: IrSourceType,
): 'openapi3' | 'openapi31' | 'swagger2' {
  if (sourceType === 'openapi31') {
    return 'openapi31';
  }
  if (sourceType === 'swagger2') {
    return 'swagger2';
  }
  return 'openapi3';
}
