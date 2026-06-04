import { applyCuration, emptyCuration } from '@mcp-definer/generator/apply-curation';
import { mapIrToManifest } from '@mcp-definer/generator/map-ir-to-manifest';
import type { CurationProfile, IntermediateRepresentation, Manifest } from '@mcp-definer/schemas';
import { CURATION_VERSION } from '@mcp-definer/schemas';

export function createEmptyCuration(): CurationProfile {
  return emptyCuration();
}

export function buildManifestFromIr(
  ir: IntermediateRepresentation,
  curation: CurationProfile,
  meta: { slug: string; name: string; description?: string },
): Manifest {
  const base = mapIrToManifest(ir, {
    name: meta.slug,
    displayName: meta.name,
    description: meta.description,
  });
  return applyCuration(base, curation, ir);
}

export function toggleOperationExcluded(
  curation: CurationProfile,
  operationId: string,
  excluded: boolean,
): CurationProfile {
  const current = new Set(curation.excludedOperationIds ?? []);
  if (excluded) {
    current.add(operationId);
  } else {
    current.delete(operationId);
  }
  return { ...curation, excludedOperationIds: [...current] };
}

export function bulkSetExcluded(
  curation: CurationProfile,
  operationIds: string[],
  excluded: boolean,
): CurationProfile {
  const current = new Set(curation.excludedOperationIds ?? []);
  for (const id of operationIds) {
    if (excluded) current.add(id);
    else current.delete(id);
  }
  return { ...curation, excludedOperationIds: [...current] };
}

export function updateToolDescription(
  curation: CurationProfile,
  operationId: string,
  description: string,
): CurationProfile {
  const toolDescriptions = { ...(curation.toolDescriptions ?? {}) };
  if (description.trim()) {
    toolDescriptions[operationId] = description;
  } else {
    delete toolDescriptions[operationId];
  }
  return { ...curation, toolDescriptions };
}

export function updateToolRename(
  curation: CurationProfile,
  operationId: string,
  name: string,
): CurationProfile {
  const toolRenames = { ...(curation.toolRenames ?? {}) };
  if (name.trim() && name !== operationId) {
    toolRenames[operationId] = name;
  } else {
    delete toolRenames[operationId];
  }
  return { ...curation, toolRenames };
}

export function updateToolGroup(
  curation: CurationProfile,
  operationId: string,
  group: string,
): CurationProfile {
  const toolGroups = { ...(curation.toolGroups ?? {}) };
  if (group.trim()) {
    toolGroups[operationId] = group;
  } else {
    delete toolGroups[operationId];
  }
  return { ...curation, toolGroups };
}

export function updateInputSchemaOverride(
  curation: CurationProfile,
  operationId: string,
  schema: Record<string, unknown> | undefined,
): CurationProfile {
  const inputSchemaOverrides = { ...(curation.inputSchemaOverrides ?? {}) };
  if (schema) {
    inputSchemaOverrides[operationId] = schema;
  } else {
    delete inputSchemaOverrides[operationId];
  }
  return { ...curation, inputSchemaOverrides };
}

export function ensureCurationVersion(curation: CurationProfile): CurationProfile {
  return { ...curation, curationVersion: CURATION_VERSION };
}

export interface DescriptionQuality {
  level: 'good' | 'warn' | 'bad';
  message: string;
}

export function assessDescriptionQuality(description: string | undefined): DescriptionQuality {
  if (!description?.trim()) {
    return { level: 'bad', message: 'Description is empty — agents rely on this for tool selection.' };
  }
  if (description.trim().length < 20) {
    return { level: 'warn', message: 'Description is very short — add context about when to use this tool.' };
  }
  if (description.trim().length < 50) {
    return { level: 'warn', message: 'Consider a richer description with parameters and use cases.' };
  }
  return { level: 'good', message: 'Description looks adequate for agent comprehension.' };
}

export function getEffectiveToolName(operationId: string, curation: CurationProfile): string {
  return curation.toolRenames?.[operationId] ?? operationId;
}

export function getEffectiveDescription(
  operationId: string,
  curation: CurationProfile,
  fallback?: string,
): string {
  return curation.toolDescriptions?.[operationId] ?? fallback ?? '';
}

export function isOperationIncluded(operationId: string, curation: CurationProfile): boolean {
  return !(curation.excludedOperationIds ?? []).includes(operationId);
}
