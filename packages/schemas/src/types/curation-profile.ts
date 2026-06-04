import type { HttpMethod, JsonSchema } from './ir.js';

export interface CurationFilters {
  tags?: string[];
  methods?: HttpMethod[];
  pathPrefixes?: string[];
}

export interface CurationProfile {
  curationVersion: '1.0';
  excludedOperationIds?: string[];
  toolRenames?: Record<string, string>;
  toolDescriptions?: Record<string, string>;
  toolGroups?: Record<string, string>;
  inputSchemaOverrides?: Record<string, JsonSchema>;
  responseShapeOverrides?: Record<string, Record<string, unknown>>;
  filters?: CurationFilters;
  metaToolsEnabled?: boolean;
}

export const CURATION_VERSION = '1.0' as const;
