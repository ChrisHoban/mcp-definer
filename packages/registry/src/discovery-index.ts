import type { DiscoveryIndexRow } from '@mcp-definer/db';

import type {
  BuildIndexOptions,
  DiscoveryIndexEntry,
  DiscoveryIndexReader,
  DiscoveryIndexV1,
  RegistryContext,
} from './types.js';
import { installPath, manifestPath } from './urls.js';

export function isDiscoveryIndexReader(
  store: RegistryContext['store'],
): store is RegistryContext['store'] & DiscoveryIndexReader {
  const candidate = store as unknown as DiscoveryIndexReader;
  return typeof candidate.listDiscoveryIndexEntries === 'function';
}

function rowToEntry(row: DiscoveryIndexRow, baseUrl: string): DiscoveryIndexEntry {
  const channel = row.channel === 'draft' ? 'stable' : (row.channel as 'stable' | 'beta');
  return {
    org: row.org_slug,
    slug: row.mcp_slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    latestVersion: row.latest_version,
    channel,
    mcpProtocolVersion: row.mcp_protocol_version,
    toolCount: Number(row.tool_count),
    toolNames: [...row.tool_names].sort((a, b) => a.localeCompare(b)),
    tags: row.tags ?? [],
    installUrl: `${baseUrl}${installPath(row.org_slug, row.mcp_slug)}`,
    manifestUrl: `${baseUrl}${manifestPath(row.org_slug, row.mcp_slug, row.latest_version)}`,
  };
}

/** Build discovery index v1 from the materialized discovery_index view. */
export async function buildIndexFromDiscoveryView(
  ctx: RegistryContext,
  reader: DiscoveryIndexReader,
  options: BuildIndexOptions = {},
): Promise<DiscoveryIndexV1> {
  const baseUrl = ctx.baseUrl ?? '/v1';
  const limit = Math.min(options.limit ?? 50, 100);

  const { entries, nextCursor } = await reader.listDiscoveryIndexEntries({
    limit,
    cursor: options.cursor,
    baseUrl,
  });

  return {
    indexVersion: '1.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    entries,
    nextCursor,
  };
}

export function discoveryRowsToEntries(
  rows: DiscoveryIndexRow[],
  baseUrl: string,
): DiscoveryIndexEntry[] {
  return rows.map((row) => rowToEntry(row, baseUrl));
}
