import { buildIndexFromDiscoveryView, isDiscoveryIndexReader } from './discovery-index.js';
import type {
  BuildIndexOptions,
  DiscoveryIndexEntry,
  DiscoveryIndexV1,
  RegistryContext,
  StoredMcp,
  StoredMcpVersion,
} from './types.js';
import { installPath, manifestPath } from './urls.js';

function entryFromMcp(
  mcp: StoredMcp,
  version: StoredMcpVersion,
  tools: { name: string; enabled: boolean }[],
  baseUrl: string,
): DiscoveryIndexEntry {
  const toolNames = tools
    .filter((t) => t.enabled)
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b));
  return {
    org: mcp.orgSlug,
    slug: mcp.slug,
    name: mcp.name,
    description: mcp.description,
    visibility: mcp.visibility,
    latestVersion: version.version,
    channel: version.channel === 'draft' ? 'stable' : version.channel,
    mcpProtocolVersion: version.mcpProtocolVersion,
    toolCount: toolNames.length,
    toolNames,
    tags: mcp.tags,
    installUrl: `${baseUrl}${installPath(mcp.orgSlug, mcp.slug)}`,
    manifestUrl: `${baseUrl}${manifestPath(mcp.orgSlug, mcp.slug, version.version)}`,
  };
}

/** Build discovery index v1 (ADR-010). */
export async function buildIndex(
  ctx: RegistryContext,
  options: BuildIndexOptions = {},
): Promise<DiscoveryIndexV1> {
  if (isDiscoveryIndexReader(ctx.store)) {
    return buildIndexFromDiscoveryView(ctx, ctx.store, options);
  }

  const baseUrl = ctx.baseUrl ?? '/v1';
  const limit = Math.min(options.limit ?? 50, 100);
  const published = await ctx.store.listPublishedMcps();
  published.sort((a, b) => a.orgSlug.localeCompare(b.orgSlug) || a.slug.localeCompare(b.slug));

  let start = 0;
  if (options.cursor) {
    const idx = published.findIndex((mcp) => mcp.id === options.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }

  const page = published.slice(start, start + limit);
  const entries: DiscoveryIndexEntry[] = [];

  for (const mcp of page) {
    const latest = await ctx.store.getLatestPublishedVersion(mcp.id);
    if (!latest) {
      continue;
    }
    const tools = await ctx.store.getToolsForVersion(latest.id);
    entries.push(entryFromMcp(mcp, latest, tools, baseUrl));
  }

  const nextCursor = start + limit < published.length ? (page[page.length - 1]?.id ?? null) : null;

  return {
    indexVersion: '1.0',
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    entries,
    nextCursor,
  };
}
