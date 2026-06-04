import { createHash } from 'node:crypto';

import type { CurationProfile, Manifest, ManifestTool } from '@mcp-definer/schemas';
import { serializeCanonical } from '@mcp-definer/schemas';

import { buildInstallSnippetTemplate } from './install-snippet.js';
import type { StoredInstallTarget, StoredTool } from './types.js';

export function id(prefix: string): string {
  return `${prefix}_${createHash('sha256').update(`${prefix}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 12)}`;
}

export function manifestHash(manifest: Manifest): string {
  return createHash('sha256').update(serializeCanonical(manifest)).digest('hex');
}

export function curationHash(curation: CurationProfile): string {
  return createHash('sha256').update(serializeCanonical(curation)).digest('hex');
}

export function normalizeSpecText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function sha256SpecHash(text: string): string {
  const normalized = normalizeSpecText(text);
  const digest = createHash('sha256').update(normalized, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

export function toolsFromManifest(manifest: Manifest, versionId: string): StoredTool[] {
  return manifest.tools.map((tool) => ({
    id: id('tool'),
    mcpVersionId: versionId,
    name: tool.name,
    description: tool.description,
    enabled: tool.enabled,
    tags: tool.group ? [tool.group] : [],
  }));
}

export function pgToolsFromManifest(manifest: Manifest, versionId: string): PgToolRow[] {
  return manifest.tools.map((tool) => toolToPgRow(tool, versionId));
}

export interface PgToolRow {
  mcpVersionId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  httpMethod: string;
  pathTemplate: string;
  tags: string[];
  enabled: boolean;
  toolGroup: string | null;
}

function toolToPgRow(tool: ManifestTool, versionId: string): PgToolRow {
  return {
    mcpVersionId: versionId,
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema as Record<string, unknown>,
    httpMethod: tool.request.method,
    pathTemplate: tool.request.pathTemplate,
    tags: tool.group ? [tool.group] : [],
    enabled: tool.enabled,
    toolGroup: tool.group ?? null,
  };
}

export function installTargetsForVersion(versionId: string): StoredInstallTarget[] {
  return [
    {
      id: id('inst'),
      mcpVersionId: versionId,
      harness: 'cursor',
      transport: 'stdio',
      configSnippet: buildInstallSnippetTemplate('cursor'),
      instructions: 'Add to Cursor MCP settings and supply the credential env var at install time.',
    },
  ];
}

export function stubUserEmail(stubUserId: string): string {
  return `${stubUserId}@stub.mcp-definer.local`;
}
