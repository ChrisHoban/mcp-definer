import { RegistryError } from './errors.js';
import type { DeprecateVersionInput, RegistryContext } from './types.js';

export interface DeprecateVersionResult {
  org: string;
  slug: string;
  version: string;
  deprecatedAt: string;
}

export async function deprecateVersion(
  ctx: RegistryContext,
  input: DeprecateVersionInput,
): Promise<DeprecateVersionResult> {
  const mcp = await ctx.store.getMcp(input.org, input.slug);
  if (!mcp) {
    throw new RegistryError('NOT_FOUND', `MCP not found: ${input.org}/${input.slug}`);
  }

  const version = await ctx.store.getVersion(input.org, input.slug, input.version);
  if (!version) {
    throw new RegistryError('NOT_FOUND', `Version not found: ${input.version}`);
  }

  const deprecated = await ctx.store.deprecateVersion(version.id, input.actorId);

  await ctx.store.emitAuditEvent({
    orgId: mcp.orgId,
    actorId: input.actorId,
    action: 'mcp.version.deprecate',
    targetType: 'mcp_version',
    targetId: version.id,
    metadata: { reason: input.reason, version: input.version },
  });

  return {
    org: input.org,
    slug: input.slug,
    version: deprecated.version,
    deprecatedAt: deprecated.deprecatedAt!,
  };
}
