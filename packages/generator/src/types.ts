import type {
  CurationProfile,
  IntermediateRepresentation,
  IrSourceType,
  Manifest,
} from '@mcp-definer/schemas';

export interface GeneratorWarning {
  code: string;
  message: string;
  path?: string;
}

export type SpecInput =
  | { kind: 'text'; content: string; filename?: string }
  | { kind: 'file'; path: string }
  | { kind: 'url'; url: string };

import type { FetchSpecUrlOptions } from './fetch-spec-url.js';

export interface ParseSpecOptions {
  /** When omitted, format is auto-detected from parsed document. */
  formatHint?: IrSourceType;
  /** Required when `SpecInput.kind` is `url` (ADR-013 allow-list). */
  fetch?: FetchSpecUrlOptions;
}

export interface ParseSpecResult {
  ir: IntermediateRepresentation;
  format: IrSourceType;
  warnings: GeneratorWarning[];
  /** Raw spec text used for hashing (normalized line endings). */
  specText: string;
}

export interface MapIrOptions {
  /** MCP slug (manifest.name). */
  name: string;
  displayName?: string;
  description?: string;
  /** Credential binding id (ADR-004). */
  authBindingId?: string;
  /** Security scheme name from IR to bind; default picks primary apiKey or first scheme. */
  securityScheme?: string;
}

export interface ApplyCurationOptions {
  /** When true, excluded/filtered tools are removed; when false, marked enabled: false. Default: remove. */
  disableInsteadOfRemove?: boolean;
}

export interface RegenerateWithDiffInput {
  previousIr: IntermediateRepresentation;
  previousManifest: Manifest;
  newIr: IntermediateRepresentation;
  curation: CurationProfile;
  mapOptions: MapIrOptions;
}

export interface ToolChangeDetail {
  operationId: string;
  toolName: string;
  fields: Array<
    'description' | 'inputSchema' | 'request' | 'response' | 'group' | 'enabled' | 'name'
  >;
}

export interface ManifestDiff {
  added: ToolChangeDetail[];
  removed: ToolChangeDetail[];
  changed: ToolChangeDetail[];
}

export interface RegenerateWithDiffResult {
  manifest: Manifest;
  diff: ManifestDiff;
  warnings: GeneratorWarning[];
}
