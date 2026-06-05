import { Hono } from 'hono';

import {
  BindingConflictError,
  BindingNotFoundError,
  type CreateCredentialBindingInput,
} from '@mcp-definer/auth';
import {
  applyCuration,
  emptyCuration,
  mapIrToManifest,
  parseSpec,
  regenerateWithDiff,
  SpecFetchError,
  SpecParseError,
} from '@mcp-definer/generator';
import {
  deprecateVersion,
  publishVersion,
  RegistryError,
  type AuthorState,
} from '@mcp-definer/registry';
import type { CurationProfile, Manifest } from '@mcp-definer/schemas';
import { validateManifest } from '@mcp-definer/schemas';
import {
  EgressBlockedError,
  executeToolCall,
  ToolValidationError,
  UpstreamHttpError,
} from '@mcp-definer/request-pipeline';

import type { AppContext } from '../context.js';
import type { ApiEnv } from '../middleware/auth.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  badRequest,
  conflict,
  handleRegistryError,
  notFound,
  problem,
  sendProblem,
} from '../errors.js';

function mcpSummary(mcp: {
  id: string;
  orgSlug: string;
  slug: string;
  name: string;
  description: string;
  visibility: string;
  tags: string[];
  status: string;
  latestVersionId: string | null;
}) {
  return {
    id: mcp.id,
    org: mcp.orgSlug,
    slug: mcp.slug,
    name: mcp.name,
    description: mcp.description,
    visibility: mcp.visibility,
    tags: mcp.tags,
    status: mcp.status,
    latestVersionId: mcp.latestVersionId,
  };
}

async function emitAudit(
  app: AppContext,
  c: { get: (key: 'auth') => unknown },
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  const auth = c.get('auth') as ApiEnv['Variables']['auth'];
  await app.registryStore.emitAuditEvent({
    orgId: auth.orgId,
    actorId: auth.userId,
    action,
    targetType,
    targetId,
    metadata,
  });
}

export function createControlPlaneRoutes(ctx: AppContext): Hono<ApiEnv> {
  const routes = new Hono<ApiEnv>();
  routes.use('*', authMiddleware(ctx));

  routes.post('/specs/parse', requirePermission('mcp:create'), async (c) => {
    const body = await c.req.json<{
      content?: string;
      url?: string;
      filename?: string;
    }>();

    if (!body.content && !body.url) {
      return badRequest(c, 'Provide content or url');
    }

    try {
      const result = body.url
        ? await parseSpec(
            { kind: 'url', url: body.url },
            { fetch: { allowlist: ctx.config.specFetchAllowlist } },
          )
        : await parseSpec({
            kind: 'text',
            content: body.content!,
            filename: body.filename,
          });
      return c.json({
        ir: result.ir,
        format: result.format,
        warnings: result.warnings,
        operationCount: result.ir.operations.length,
        specText: result.specText,
      });
    } catch (error) {
      if (error instanceof SpecFetchError) {
        return badRequest(c, error.message);
      }
      if (error instanceof SpecParseError) {
        return badRequest(c, error.message);
      }
      if (error instanceof SyntaxError) {
        return badRequest(c, error.message);
      }
      if (error instanceof Error && error.message.includes('allow-list')) {
        return badRequest(c, error.message);
      }
      throw error;
    }
  });

  routes.post('/mcps', requirePermission('mcp:create'), async (c) => {
    const body = await c.req.json<{
      org?: string;
      slug: string;
      name: string;
      description?: string;
      visibility?: 'private' | 'org' | 'public';
      tags?: string[];
      manifest?: Manifest;
      ir?: import('@mcp-definer/schemas').IntermediateRepresentation;
      curation?: CurationProfile;
      version?: string;
      specText?: string;
      authorState?: AuthorState;
    }>();

    const auth = c.get('auth');
    const app = ctx;
    const org = body.org ?? auth.orgSlug;

    let manifest = body.manifest;
    const curation = body.curation ?? emptyCuration();
    if (!manifest && body.ir) {
      const base = mapIrToManifest(body.ir, {
        name: body.slug,
        displayName: body.name,
        description: body.description,
      });
      manifest = applyCuration(base, curation, body.ir);
    }

    if (!manifest) {
      return badRequest(c, 'manifest or ir is required');
    }

    const sourceSpec =
      body.specText && body.ir
        ? {
            specText: body.specText,
            specType: body.ir.source.type,
            specHash: body.ir.source.hash,
          }
        : undefined;

    try {
      const { mcp, version } = await app.registryStore.createMcp({
        org,
        slug: body.slug,
        name: body.name,
        description: body.description ?? '',
        visibility: body.visibility ?? 'private',
        ownerId: auth.userId,
        tags: body.tags ?? [],
        manifest,
        version: body.version ?? '0.1.0',
        sourceSpec,
        curation,
        authorState: body.authorState,
      });

      await emitAudit(ctx, c, 'mcp.create', 'mcp', mcp.id, { slug: body.slug });

      return c.json(
        {
          ...mcpSummary(mcp),
          draftVersion: version.version,
        },
        201,
      );
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.get('/mcps', requirePermission('mcp:read'), async (c) => {
    const app = ctx;
    const cursor = c.req.query('cursor');
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;
    const status = c.req.query('status') as
      | 'draft'
      | 'published'
      | 'deprecated'
      | 'retired'
      | undefined;
    const visibility = c.req.query('visibility') as 'private' | 'org' | 'public' | undefined;
    const tag = c.req.query('tag');

    const { items, nextCursor } = await app.registryStore.listMcps({
      cursor: cursor ?? undefined,
      limit,
      status,
      visibility,
      tag: tag ?? undefined,
    });

    return c.json({
      items: items.map(mcpSummary),
      nextCursor,
    });
  });

  routes.get('/mcps/:id', requirePermission('mcp:read'), async (c) => {
    const app = ctx;
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const latest = mcp.latestVersionId
      ? await app.registryStore.getVersionById(mcp.latestVersionId)
      : null;

    return c.json({
      ...mcpSummary(mcp),
      latestVersion: latest
        ? {
            version: latest.version,
            channel: latest.channel,
            publishedAt: latest.publishedAt,
          }
        : null,
    });
  });

  routes.patch('/mcps/:id', requirePermission('mcp:edit'), async (c) => {
    const app = ctx;
    const body = await c.req.json<{
      name?: string;
      description?: string;
      visibility?: 'private' | 'org' | 'public';
      tags?: string[];
    }>();

    try {
      const mcp = await app.registryStore.updateMcp(c.req.param('id'), body);
      await emitAudit(ctx, c, 'mcp.update', 'mcp', mcp.id);
      return c.json(mcpSummary(mcp));
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.delete('/mcps/:id', requirePermission('mcp:delete'), async (c) => {
    const app = ctx;
    try {
      const mcp = await app.registryStore.archiveMcp(c.req.param('id'));
      await emitAudit(ctx, c, 'mcp.archive', 'mcp', mcp.id);
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.post('/mcps/:id/versions', requirePermission('mcp:edit'), async (c) => {
    const app = ctx;
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const body = await c.req.json<{ version: string; manifest: Manifest }>();
    if (!body.version || !body.manifest) {
      return badRequest(c, 'version and manifest are required');
    }

    try {
      const version = await app.registryStore.createDraftVersion({
        org: mcp.orgSlug,
        slug: mcp.slug,
        version: body.version,
        manifest: body.manifest,
        ownerId: c.get('auth').userId,
      });
      await emitAudit(ctx, c, 'mcp.version.create', 'mcp_version', version.id);
      return c.json(
        {
          id: version.id,
          version: version.version,
          channel: version.channel,
          publishedAt: version.publishedAt,
        },
        201,
      );
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.get('/mcps/:id/versions', requirePermission('mcp:read'), async (c) => {
    const app = ctx;
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const versions = await app.registryStore.listVersions!(mcp.id);
    return c.json({
      items: versions.map((v) => ({
        id: v.id,
        version: v.version,
        channel: v.channel,
        publishedAt: v.publishedAt,
        deprecatedAt: v.deprecatedAt,
      })),
    });
  });

  routes.get('/mcps/:id/versions/:ver', requirePermission('mcp:read'), async (c) => {
    const app = ctx;
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const version = await app.registryStore.getVersionForMcp(mcp.id, c.req.param('ver'));
    if (!version) {
      return notFound(c, 'Version not found');
    }

    const manifest = await app.registryStore.getManifestById(version.manifestId);
    const tools = await app.registryStore.getToolsForVersion(version.id);
    const authoring = await app.registryStore.getVersionAuthoringData(version.id);

    return c.json({
      id: version.id,
      version: version.version,
      channel: version.channel,
      publishedAt: version.publishedAt,
      deprecatedAt: version.deprecatedAt,
      manifest: manifest?.content,
      tools,
      specText: authoring.sourceSpec?.contentText ?? null,
      curation: authoring.curation,
      authorState: authoring.authorState,
    });
  });

  routes.patch('/mcps/:id/versions/:ver', requirePermission('mcp:edit'), async (c) => {
    const app = ctx;
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const version = await app.registryStore.getVersionForMcp(mcp.id, c.req.param('ver'));
    if (!version) {
      return notFound(c, 'Version not found');
    }

    if (version.publishedAt) {
      return conflict(c, 'Published versions are immutable');
    }

    const body = await c.req.json<{
      manifest?: Manifest;
      curation?: CurationProfile;
      authorState?: AuthorState;
      specText?: string;
      specType?: string;
      specHash?: string;
    }>();

    if (!body.manifest && !body.curation && !body.authorState && !body.specText) {
      return badRequest(
        c,
        'At least one of manifest, curation, authorState, or specText is required',
      );
    }

    const sourceSpec =
      body.specText && body.specType
        ? {
            specText: body.specText,
            specType: body.specType,
            specHash: body.specHash,
          }
        : undefined;

    try {
      const updated = await app.registryStore.updateDraftVersion(version.id, {
        manifest: body.manifest,
        curation: body.curation,
        authorState: body.authorState,
        sourceSpec,
      });
      await emitAudit(ctx, c, 'mcp.version.update', 'mcp_version', updated.id);
      return c.json({
        id: updated.id,
        version: updated.version,
        channel: updated.channel,
        publishedAt: updated.publishedAt,
      });
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.post('/mcps/:id/versions/:ver/validate', requirePermission('mcp:edit'), async (c) => {
    const app = ctx;
    const ver = c.req.param('ver');
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const version = await app.registryStore.getVersionForMcp(mcp.id, ver);
    if (!version) {
      return notFound(c, 'Version not found');
    }

    const manifest = await app.registryStore.getManifestById(version.manifestId);
    if (!manifest) {
      return notFound(c, 'Manifest not found');
    }

    const result = validateManifest(manifest.content);
    return c.json({
      valid: result.valid,
      errors: result.errors ?? [],
      warnings: result.warnings ?? [],
    });
  });

  routes.post('/mcps/:id/versions/:ver/publish', requirePermission('mcp:publish'), async (c) => {
    const app = ctx;
    const ver = c.req.param('ver');
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const body = await c.req.json<{ channel?: 'stable' | 'beta' }>();
    const channel = body.channel ?? 'stable';

    try {
      const result = await publishVersion(app.registry, {
        org: mcp.orgSlug,
        slug: mcp.slug,
        version: ver,
        channel,
        actorId: c.get('auth').userId,
      });
      return c.json(result);
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.post(
    '/mcps/:id/versions/:ver/deprecate',
    requirePermission('mcp:deprecate'),
    async (c) => {
      const app = ctx;
      const ver = c.req.param('ver');
      const mcp = await app.registryStore.getMcpById(c.req.param('id'));
      if (!mcp) {
        return notFound(c, 'MCP not found');
      }

      const body = await c.req.json<{ reason?: string }>();

      try {
        const result = await deprecateVersion(app.registry, {
          org: mcp.orgSlug,
          slug: mcp.slug,
          version: ver,
          actorId: c.get('auth').userId,
          reason: body.reason,
        });
        return c.json(result);
      } catch (error) {
        if (error instanceof RegistryError) {
          return handleRegistryError(c, error);
        }
        throw error;
      }
    },
  );

  routes.post('/mcps/:id/versions/:ver/regenerate', requirePermission('mcp:edit'), async (c) => {
    const app = ctx;
    const ver = c.req.param('ver');
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const version = await app.registryStore.getVersionForMcp(mcp.id, ver);
    if (!version) {
      return notFound(c, 'Version not found');
    }

    const body = await c.req.json<{
      newIr: import('@mcp-definer/schemas').IntermediateRepresentation;
      curation?: CurationProfile;
    }>();

    const stored = await app.registryStore.getManifestById(version.manifestId);
    if (!stored) {
      return notFound(c, 'Manifest not found');
    }

    const result = regenerateWithDiff({
      previousIr: body.newIr,
      previousManifest: stored.content,
      newIr: body.newIr,
      curation: body.curation ?? emptyCuration(),
      mapOptions: {
        name: mcp.slug,
        displayName: mcp.name,
        description: mcp.description,
      },
    });

    return c.json({
      manifest: result.manifest,
      diff: result.diff,
      warnings: result.warnings,
    });
  });

  routes.post('/mcps/:id/tools/:tool/invoke', requirePermission('mcp:test_invoke'), async (c) => {
    const app = ctx;
    const mcp = await app.registryStore.getMcpById(c.req.param('id'));
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const verParam = c.req.query('version');
    const version = verParam
      ? await app.registryStore.getVersionForMcp(mcp.id, verParam)
      : ((mcp.latestVersionId
          ? await app.registryStore.getVersionById(mcp.latestVersionId)
          : null) ?? (await app.registryStore.listVersions!(mcp.id))[0]);

    if (!version) {
      return notFound(c, 'Version not found');
    }

    const stored = await app.registryStore.getManifestById(version.manifestId);
    if (!stored) {
      return notFound(c, 'Manifest not found');
    }

    const manifest = stored.content;
    const toolName = c.req.param('tool');
    const tool = manifest.tools.find((t) => t.name === toolName && t.enabled);
    if (!tool) {
      return notFound(c, `Tool not found: ${toolName}`);
    }

    const body = await c.req.json<{ args?: Record<string, unknown> }>();
    const binding = await app.bindingStore.getByMcpId(mcp.id);

    if (!binding?.hasSecret) {
      return badRequest(c, 'Configure a credential binding with a secret before invoking');
    }

    try {
      app.manifestAuthByBindingId.set(manifest.auth.bindingId, manifest.auth);
      const credential = await app.credentialResolver.resolve(manifest.auth.bindingId);
      const capturedRequests: Record<string, unknown>[] = [];

      const result = await executeToolCall(manifest, tool, body.args ?? {}, credential, {
        onRequest: (request) => {
          capturedRequests.push(request);
        },
      });

      return c.json({
        result,
        requestLog: capturedRequests,
      });
    } catch (error) {
      if (error instanceof ToolValidationError) {
        return sendProblem(c, problem(400, 'TOOL_VALIDATION', error.message, 'TOOL_VALIDATION'));
      }
      if (error instanceof EgressBlockedError) {
        return sendProblem(c, problem(403, 'EGRESS_BLOCKED', error.message, 'EGRESS_BLOCKED'));
      }
      if (error instanceof UpstreamHttpError) {
        return sendProblem(
          c,
          problem(error.status, 'UPSTREAM_HTTP', error.message, 'UPSTREAM_HTTP'),
        );
      }
      throw error;
    }
  });

  routes.get('/mcps/:id/credentials', requirePermission('mcp:configure_auth'), async (c) => {
    const app = ctx;
    const binding = await app.bindingStore.getByMcpId(c.req.param('id'));
    if (!binding) {
      return c.json({ binding: null });
    }
    return c.json({ binding });
  });

  routes.post('/mcps/:id/credentials', requirePermission('mcp:configure_auth'), async (c) => {
    const app = ctx;
    const mcpId = c.req.param('id');
    const mcp = await app.registryStore.getMcpById(mcpId);
    if (!mcp) {
      return notFound(c, 'MCP not found');
    }

    const body = await c.req.json<CreateCredentialBindingInput & { secret: string }>();
    if (!body.id || !body.authType || !body.secret) {
      return badRequest(c, 'id, authType, and secret are required');
    }

    try {
      const binding = await app.bindingStore.create({ ...body, mcpId }, body.secret, mcp.orgSlug);
      await emitAudit(ctx, c, 'credential.create', 'credential_binding', binding.id);
      return c.json({ binding }, 201);
    } catch (error) {
      if (error instanceof BindingConflictError) {
        return conflict(c, error.message);
      }
      throw error;
    }
  });

  routes.delete('/mcps/:id/credentials', requirePermission('mcp:configure_auth'), async (c) => {
    const app = ctx;
    const binding = await app.bindingStore.getByMcpId(c.req.param('id'));
    if (!binding) {
      return notFound(c, 'Credential binding not found');
    }

    try {
      await app.bindingStore.delete(binding.id);
      await emitAudit(ctx, c, 'credential.delete', 'credential_binding', binding.id);
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof BindingNotFoundError) {
        return notFound(c, error.message);
      }
      throw error;
    }
  });

  routes.get('/audit', requirePermission('catalog:read'), async (c) => {
    const app = ctx;
    const orgId = c.req.query('orgId') ?? c.get('auth').orgId;
    const events = await app.registryStore.listAuditEvents(orgId);
    return c.json({ items: events });
  });

  return routes;
}
