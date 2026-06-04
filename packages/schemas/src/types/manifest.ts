import type { JsonSchema } from './ir.js';

export type ManifestAuthType = 'apiKey' | 'bearer' | 'oauth2_cc' | 'oauth2_ac' | 'basic' | 'custom';

export interface AuthApplyApiKey {
  in: 'header' | 'query';
  name: string;
}

export interface AuthApplyBearer {
  headerName?: string;
  prefix?: string;
}

export interface AuthApplyOAuth2Cc {
  tokenUrl: string;
  scopes?: string[];
}

export interface AuthApplyOAuth2Ac {
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
}

export interface AuthApplyBasic {
  [key: string]: never;
}

export interface AuthApplyCustom {
  headers: Record<string, string>;
}

export type AuthApply =
  | AuthApplyApiKey
  | AuthApplyBearer
  | AuthApplyOAuth2Cc
  | AuthApplyOAuth2Ac
  | AuthApplyBasic
  | AuthApplyCustom;

export interface ManifestAuth {
  bindingId: string;
  type: ManifestAuthType;
  apply: AuthApply;
}

export type TransportMode = 'stdio' | 'http';

export interface ManifestTransport {
  modes: TransportMode[];
  default: TransportMode;
}

export interface ManifestTargetApi {
  specType: 'openapi3' | 'openapi31' | 'swagger2';
  specHash: string;
  baseUrl: string;
  baseUrlOverridable?: boolean;
}

export type ParamMapLocation = 'path' | 'query' | 'header' | 'body';

export interface ParamMapEntry {
  in: ParamMapLocation;
}

export interface ToolRequest {
  method: import('./ir.js').HttpMethod;
  pathTemplate: string;
  paramMap: Record<string, ParamMapEntry>;
  bodyParam?: string | null;
}

export type ResponseShape = 'passthrough' | 'summarize' | 'jsonpath';

export interface ToolResponse {
  shape: ResponseShape;
  successStatus: string[];
  errorMap: Record<string, string>;
  jsonpath?: string;
}

export interface ToolPagination {
  type: 'offset' | 'cursor' | 'link';
  paramNames?: Record<string, string>;
}

export interface ToolRateLimit {
  requestsPerMinute: number;
}

export interface ManifestTool {
  name: string;
  description: string;
  enabled: boolean;
  group?: string;
  inputSchema: JsonSchema;
  request: ToolRequest;
  response: ToolResponse;
  pagination?: ToolPagination | null;
  rateLimit?: ToolRateLimit | null;
}

export interface ManifestResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface ManifestPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface ManifestPrompt {
  name: string;
  description: string;
  arguments?: ManifestPromptArgument[];
}

export interface ManifestPolicies {
  timeoutMs: number;
  retries: {
    max: number;
    backoffMs: number;
  };
  egressAllowlist: string[];
}

export interface Manifest {
  manifestSchemaVersion: '1.0';
  mcpProtocolVersion: '2024-11-05';
  name: string;
  displayName: string;
  description: string;
  targetApi: ManifestTargetApi;
  transport: ManifestTransport;
  auth: ManifestAuth;
  tools: ManifestTool[];
  resources: ManifestResource[];
  prompts: ManifestPrompt[];
  policies: ManifestPolicies;
}

export const MANIFEST_SCHEMA_VERSION = '1.0' as const;
export const MCP_PROTOCOL_VERSION = '2024-11-05' as const;
