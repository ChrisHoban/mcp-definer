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
} from './types/ir.js';
export { IR_VERSION } from './types/ir.js';

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
} from './types/manifest.js';
export { MANIFEST_SCHEMA_VERSION, MCP_PROTOCOL_VERSION } from './types/manifest.js';

export type { CurationProfile, CurationFilters } from './types/curation-profile.js';
export { CURATION_VERSION } from './types/curation-profile.js';

export type {
  ValidationResult,
  ValidationIssue,
  ValidateManifestResult,
  ValidateIrResult,
  ValidateCurationProfileResult,
} from './types/validation.js';

export { validateManifest, assertManifest } from './validate/manifest.js';
export { validateIr, assertIr } from './validate/ir.js';
export { validateCurationProfile, assertCurationProfile } from './validate/curation-profile.js';

export {
  canonicalize,
  serializeCanonical,
  parseManifestJson,
  roundTripDeterministic,
} from './serialize.js';

export { irSchema, manifestSchema, curationProfileSchema } from './validate/ajv.js';
