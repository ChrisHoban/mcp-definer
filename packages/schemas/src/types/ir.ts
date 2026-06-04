/** JSON Schema fragment (OpenAPI-style). */
export type JsonSchema = Record<string, unknown>;

export type IrSourceType =
  | 'openapi3'
  | 'openapi31'
  | 'swagger2'
  | 'graphql'
  | 'grpc'
  | 'asyncapi'
  | 'postman';

export interface IrSource {
  type: IrSourceType;
  hash: string;
  title?: string;
  version?: string;
}

export interface IrServer {
  url: string;
  description?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type ParameterLocation = 'path' | 'query' | 'header' | 'cookie';

export interface IrParameter {
  in: ParameterLocation;
  name: string;
  required: boolean;
  description?: string;
  schema: JsonSchema;
}

export interface IrRequestBody {
  required: boolean;
  contentType?: string;
  schema?: JsonSchema;
}

export interface IrResponse {
  status: string;
  description?: string;
  contentType?: string;
  schema?: JsonSchema;
}

export interface IrOperation {
  id: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters: IrParameter[];
  requestBody?: IrRequestBody;
  responses: IrResponse[];
  security?: string[];
}

export type IrSecuritySchemeType = 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';

export interface IrSecurityScheme {
  type: IrSecuritySchemeType;
  in?: 'header' | 'query' | 'cookie';
  name?: string;
  scheme?: string;
  bearerFormat?: string;
  flows?: Record<string, unknown>;
  openIdConnectUrl?: string;
  description?: string;
}

export interface IntermediateRepresentation {
  irVersion: '1.0';
  source: IrSource;
  servers: IrServer[];
  operations: IrOperation[];
  securitySchemes: Record<string, IrSecurityScheme>;
}

export const IR_VERSION = '1.0' as const;
