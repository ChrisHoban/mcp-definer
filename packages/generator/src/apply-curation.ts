import type {
  CurationProfile,
  CurationFilters,
  HttpMethod,
  IntermediateRepresentation,
  IrOperation,
  Manifest,
  ManifestTool,
} from '@mcp-definer/schemas';
import { CURATION_VERSION } from '@mcp-definer/schemas';

import { patchInputSchema } from './map-ir-to-manifest.js';
import type { ApplyCurationOptions, GeneratorWarning } from './types.js';

const EMPTY_CURATION: CurationProfile = {
  curationVersion: CURATION_VERSION,
};

function matchesFilters(op: IrOperation, filters: CurationFilters | undefined): boolean {
  if (!filters) {
    return true;
  }

  if (filters.tags && filters.tags.length > 0) {
    const opTags = op.tags ?? [];
    if (!filters.tags.some((t) => opTags.includes(t))) {
      return false;
    }
  }

  if (filters.methods && filters.methods.length > 0) {
    if (!filters.methods.includes(op.method as HttpMethod)) {
      return false;
    }
  }

  if (filters.pathPrefixes && filters.pathPrefixes.length > 0) {
    if (!filters.pathPrefixes.some((prefix) => op.path.startsWith(prefix))) {
      return false;
    }
  }

  return true;
}

function buildOperationIndex(ir: IntermediateRepresentation): Map<string, IrOperation> {
  return new Map(ir.operations.map((op) => [op.id, op]));
}

export function applyCuration(
  manifest: Manifest,
  curation: CurationProfile = EMPTY_CURATION,
  ir?: IntermediateRepresentation,
  options: ApplyCurationOptions = {},
  warnings: GeneratorWarning[] = [],
): Manifest {
  const opIndex = ir ? buildOperationIndex(ir) : undefined;
  const excluded = new Set(curation.excludedOperationIds ?? []);
  const renames = curation.toolRenames ?? {};
  const descriptions = curation.toolDescriptions ?? {};
  const groups = curation.toolGroups ?? {};
  const schemaOverrides = curation.inputSchemaOverrides ?? {};
  const responseOverrides = curation.responseShapeOverrides ?? {};

  const tools: ManifestTool[] = [];

  for (const tool of manifest.tools) {
    const operationId = resolveOperationId(tool, opIndex, renames);
    if (!operationId) {
      tools.push(tool);
      continue;
    }

    if (excluded.has(operationId)) {
      continue;
    }

    const op = opIndex?.get(operationId);
    if (op && !matchesFilters(op, curation.filters)) {
      continue;
    }

    let next: ManifestTool = { ...tool };

    if (renames[operationId]) {
      next = { ...next, name: renames[operationId]! };
    }

    if (descriptions[operationId]) {
      next = { ...next, description: descriptions[operationId]! };
    }

    if (groups[operationId]) {
      next = { ...next, group: groups[operationId] };
    }

    if (schemaOverrides[operationId]) {
      next = {
        ...next,
        inputSchema: patchInputSchema(
          next.inputSchema,
          schemaOverrides[operationId]!,
          warnings,
          `/tools/${next.name}/inputSchema`,
        ),
      };
    }

    const responseOverride = responseOverrides[operationId];
    if (responseOverride && typeof responseOverride.shape === 'string') {
      next = {
        ...next,
        response: {
          ...next.response,
          shape: responseOverride.shape as ManifestTool['response']['shape'],
        },
      };
    }

    tools.push(next);
  }

  const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));

  return {
    ...manifest,
    tools: sortedTools,
  };
}

/** Resolve stable operation id from tool name using IR or rename inverse. */
function resolveOperationId(
  tool: ManifestTool,
  opIndex: Map<string, IrOperation> | undefined,
  renames: Record<string, string>,
): string | undefined {
  for (const [opId, renamed] of Object.entries(renames)) {
    if (tool.name === renamed) {
      return opId;
    }
  }

  if (opIndex?.has(tool.name)) {
    return tool.name;
  }

  return tool.name;
}

export function emptyCuration(): CurationProfile {
  return { curationVersion: CURATION_VERSION };
}
