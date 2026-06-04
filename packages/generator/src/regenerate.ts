import type {
  CurationProfile,
  IntermediateRepresentation,
  ManifestTool,
} from '@mcp-definer/schemas';
import { serializeCanonical } from '@mcp-definer/schemas';

import { applyCuration, emptyCuration } from './apply-curation.js';
import { mapIrToManifest } from './map-ir-to-manifest.js';
import type {
  ManifestDiff,
  RegenerateWithDiffInput,
  RegenerateWithDiffResult,
  ToolChangeDetail,
} from './types.js';

function toolDetail(operationId: string, toolName: string): ToolChangeDetail {
  return { operationId, toolName, fields: [] };
}

function toolsByOperationId(
  tools: ManifestTool[],
  ir: IntermediateRepresentation,
  curation: CurationProfile,
): Map<string, ManifestTool> {
  const renames = curation.toolRenames ?? {};
  const reverse = new Map(Object.entries(renames).map(([opId, toolName]) => [toolName, opId]));
  const validIds = new Set(ir.operations.map((o) => o.id));
  const map = new Map<string, ManifestTool>();

  for (const tool of tools) {
    const opId = reverse.get(tool.name) ?? tool.name;
    if (validIds.has(opId)) {
      map.set(opId, tool);
    }
  }

  return map;
}

function diffTools(
  previous: ManifestTool[],
  next: ManifestTool[],
  previousIr: IntermediateRepresentation,
  nextIr: IntermediateRepresentation,
  curation: CurationProfile,
): ManifestDiff {
  const prevByOp = toolsByOperationId(previous, previousIr, curation);
  const nextByOp = toolsByOperationId(next, nextIr, curation);
  const previousIrIds = new Set(previousIr.operations.map((o) => o.id));
  const nextIrIds = new Set(nextIr.operations.map((o) => o.id));

  const added: ToolChangeDetail[] = [];
  const removed: ToolChangeDetail[] = [];
  const changed: ToolChangeDetail[] = [];

  for (const id of [...nextIrIds].sort()) {
    if (!previousIrIds.has(id)) {
      const tool = nextByOp.get(id);
      added.push(toolDetail(id, tool?.name ?? id));
    }
  }

  for (const id of [...previousIrIds].sort()) {
    if (!nextIrIds.has(id)) {
      const tool = prevByOp.get(id);
      removed.push(toolDetail(id, tool?.name ?? id));
    }
  }

  for (const id of [...nextIrIds].sort()) {
    if (!previousIrIds.has(id)) {
      continue;
    }
    const prevTool = prevByOp.get(id);
    const nextTool = nextByOp.get(id);
    if (!prevTool || !nextTool) {
      continue;
    }

    const fields: ToolChangeDetail['fields'] = [];
    if (prevTool.name !== nextTool.name) {
      fields.push('name');
    }
    if (prevTool.description !== nextTool.description) {
      fields.push('description');
    }
    if (prevTool.group !== nextTool.group) {
      fields.push('group');
    }
    if (prevTool.enabled !== nextTool.enabled) {
      fields.push('enabled');
    }
    if (serializeCanonical(prevTool.inputSchema) !== serializeCanonical(nextTool.inputSchema)) {
      fields.push('inputSchema');
    }
    if (serializeCanonical(prevTool.request) !== serializeCanonical(nextTool.request)) {
      fields.push('request');
    }
    if (serializeCanonical(prevTool.response) !== serializeCanonical(nextTool.response)) {
      fields.push('response');
    }

    if (fields.length > 0) {
      changed.push({
        operationId: id,
        toolName: nextTool.name,
        fields: [...fields].sort() as ToolChangeDetail['fields'],
      });
    }
  }

  return { added, removed, changed };
}

export function regenerateWithDiff(input: RegenerateWithDiffInput): RegenerateWithDiffResult {
  const warnings: import('./types.js').GeneratorWarning[] = [];
  const curation = input.curation ?? emptyCuration();

  const previousDraft = mapIrToManifest(input.previousIr, input.mapOptions, warnings);
  const previousCurated = applyCuration(previousDraft, curation, input.previousIr, {}, warnings);

  const draft = mapIrToManifest(input.newIr, input.mapOptions, warnings);
  const manifest = applyCuration(draft, curation, input.newIr, {}, warnings);

  const diff = diffTools(
    previousCurated.tools,
    manifest.tools,
    input.previousIr,
    input.newIr,
    curation,
  );

  return { manifest, diff, warnings };
}
