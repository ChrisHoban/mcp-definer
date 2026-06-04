import { validateManifest } from '@mcp-definer/schemas';

import { RegistryError } from './errors.js';
import type { PublishVersionInput, PublishVersionResult, RegistryContext } from './types.js';
import { manifestUrl } from './urls.js';

export async function publishVersion(
  ctx: RegistryContext,
  input: PublishVersionInput,
): Promise<PublishVersionResult> {
  const mcp = await ctx.store.getMcp(input.org, input.slug);
  if (!mcp) {
    throw new RegistryError('NOT_FOUND', `MCP not found: ${input.org}/${input.slug}`);
  }

  const version = await ctx.store.getVersion(input.org, input.slug, input.version);
  if (!version) {
    throw new RegistryError('NOT_FOUND', `Version not found: ${input.version}`);
  }

  const manifest = await ctx.store.getManifestById(version.manifestId);
  if (!manifest) {
    throw new RegistryError('NOT_FOUND', 'Manifest not found for version');
  }

  const validation = validateManifest(manifest.content);
  if (!validation.valid) {
    throw new RegistryError(
      'VALIDATION_FAILED',
      `Manifest validation failed: ${(validation.errors ?? []).map((e) => e.message).join('; ')}`,
    );
  }

  const published = await ctx.store.publishVersion(version.id, input.channel, input.actorId);
  const base = ctx.baseUrl ?? '/v1';

  await ctx.store.emitAuditEvent({
    orgId: mcp.orgId,
    actorId: input.actorId,
    action: 'mcp.version.publish',
    targetType: 'mcp_version',
    targetId: version.id,
    metadata: { org: input.org, slug: input.slug, version: input.version, channel: input.channel },
  });

  return {
    org: input.org,
    slug: input.slug,
    version: published.version,
    channel: input.channel,
    publishedAt: published.publishedAt!,
    manifestUrl: manifestUrl(base, input.org, input.slug, published.version),
  };
}

export async function updateDraftManifest(
  ctx: RegistryContext,
  org: string,
  slug: string,
  version: string,
  manifest: import('@mcp-definer/schemas').Manifest,
): Promise<void> {
  const versionRecord = await ctx.store.getVersion(org, slug, version);
  if (!versionRecord) {
    throw new RegistryError('NOT_FOUND', `Version not found: ${version}`);
  }

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    throw new RegistryError(
      'VALIDATION_FAILED',
      `Manifest validation failed: ${(validation.errors ?? []).map((e) => e.message).join('; ')}`,
    );
  }

  await ctx.store.updateDraftManifest(versionRecord.id, manifest);
}
