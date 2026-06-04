import { RegistryError } from './errors.js';
import { buildInstallSnippetTemplate } from './install-snippet.js';
import type { RegistryContext, RegistryDetail, VersionSummary } from './types.js';

export async function getRegistryDetail(
  ctx: RegistryContext,
  org: string,
  slug: string,
): Promise<RegistryDetail> {
  const mcp = await ctx.store.getMcp(org, slug);
  if (!mcp) {
    throw new RegistryError('NOT_FOUND', `MCP not found: ${org}/${slug}`);
  }

  const versionRecords = ctx.store.listVersions
    ? await ctx.store.listVersions(mcp.id)
    : [];

  const summaries: VersionSummary[] = [];
  for (const ver of versionRecords) {
    const tools = await ctx.store.getToolsForVersion(ver.id);
    summaries.push({
      version: ver.version,
      channel: ver.channel,
      publishedAt: ver.publishedAt,
      deprecatedAt: ver.deprecatedAt,
      mcpProtocolVersion: ver.mcpProtocolVersion,
      manifestSchemaVersion: ver.manifestSchemaVersion,
      toolCount: tools.length,
    });
  }

  const latest = await ctx.store.getLatestPublishedVersion(mcp.id);
  const installTargets = latest
    ? (await ctx.store.getInstallTargets(latest.id)).map((target) => ({
        harness: target.harness,
        transport: target.transport,
        configSnippet: target.configSnippet,
        instructions: target.instructions,
      }))
    : [
        {
          harness: 'cursor' as const,
          transport: 'stdio' as const,
          configSnippet: buildInstallSnippetTemplate('cursor'),
          instructions: 'Publish a version to generate install targets.',
        },
      ];

  return {
    org: mcp.orgSlug,
    slug: mcp.slug,
    name: mcp.name,
    description: mcp.description,
    visibility: mcp.visibility,
    tags: mcp.tags,
    latestVersion: latest?.version ?? null,
    versions: summaries,
    installTargets,
  };
}

export async function fetchManifest(
  ctx: RegistryContext,
  org: string,
  slug: string,
  version: string,
) {
  const ver = await ctx.store.getVersion(org, slug, version);
  if (!ver) {
    throw new RegistryError('NOT_FOUND', `Version not found: ${version}`);
  }
  if (!ver.publishedAt) {
    throw new RegistryError('NOT_FOUND', `Version not published: ${version}`);
  }

  const manifest = await ctx.store.getManifestById(ver.manifestId);
  if (!manifest) {
    throw new RegistryError('NOT_FOUND', 'Manifest not found');
  }

  return manifest.content;
}
