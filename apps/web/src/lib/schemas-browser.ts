/**
 * Browser-safe re-exports from @mcp-definer/schemas (no Node/Ajv validators).
 * Used by Vite to avoid bundling node:module in the web app.
 */
export type {
  JsonSchema,
  IntermediateRepresentation,
  IrOperation,
  IrParameter,
  IrResponse,
  IrRequestBody,
  IrSecurityScheme,
  IrSecuritySchemeType,
  IrSource,
  IrSourceType,
  IrServer,
  HttpMethod,
  ParameterLocation,
} from '../../../../packages/schemas/src/types/ir.js';

export { IR_VERSION } from '../../../../packages/schemas/src/types/ir.js';

export type {
  Manifest,
  ManifestTool,
  ManifestAuth,
  ManifestAuthType,
  ManifestPolicies,
  ManifestTransport,
  ManifestTargetApi,
  AuthApply,
  ParamMapEntry,
  ToolRequest,
  ToolResponse,
} from '../../../../packages/schemas/src/types/manifest.js';

export { MANIFEST_SCHEMA_VERSION, MCP_PROTOCOL_VERSION } from '../../../../packages/schemas/src/types/manifest.js';

export type { CurationProfile, CurationFilters } from '../../../../packages/schemas/src/types/curation-profile.js';
export { CURATION_VERSION } from '../../../../packages/schemas/src/types/curation-profile.js';
