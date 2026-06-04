import { Hono } from 'hono';

import { canViewMcp } from '@mcp-definer/auth';
import {
  buildIndex,
  buildInstallSnippet,
  fetchManifest,
  getRegistryDetail,
  RegistryError,
  searchCatalog,
} from '@mcp-definer/registry';

import type { AppContext } from '../context.js';
import type { ApiEnv } from '../middleware/auth.js';
import { optionalAuthMiddleware } from '../middleware/auth.js';
import { handleRegistryError, notFound } from '../errors.js';
import { withEtag } from '../middleware/etag.js';

export function createDiscoveryRoutes(ctx: AppContext): Hono<ApiEnv> {
  const routes = new Hono<ApiEnv>();
  routes.use('*', optionalAuthMiddleware(ctx));

  routes.get('/index', async (c) => {
    const app = ctx;
    const cursor = c.req.query('cursor') ?? undefined;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;

    const index = await buildIndex(app.registry, {
      cursor,
      limit,
      generatedAt: app.config.mockMode ? '2026-06-04T12:00:00Z' : undefined,
    });
    const auth = c.get('auth');

    const visibleEntries = index.entries.filter((entry) => {
      if (entry.visibility === 'public') {
        return true;
      }
      if (!auth) {
        return false;
      }
      return canViewMcp(
        { orgId: auth.orgId, userId: auth.userId, role: auth.role },
        {
          visibility: entry.visibility,
          orgId: auth.orgId,
          ownerId: auth.userId,
        },
        auth.userId,
      );
    });

    return withEtag(c, { ...index, entries: visibleEntries });
  });

  routes.get('/registry/:org/:slug', async (c) => {
    const app = ctx;
    try {
      const detail = await getRegistryDetail(app.registry, c.req.param('org'), c.req.param('slug'));

      const auth = c.get('auth');
      if (
        detail.visibility !== 'public' &&
        !canViewMcp(
          auth ? { orgId: auth.orgId, userId: auth.userId, role: auth.role } : null,
          {
            visibility: detail.visibility,
            orgId: app.config.defaultOrgId,
            ownerId: app.config.defaultUserId,
          },
          auth?.userId,
        )
      ) {
        return notFound(c, 'MCP not found');
      }

      return withEtag(c, detail);
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.get('/registry/:org/:slug/versions/:ver/manifest', async (c) => {
    const app = ctx;
    try {
      const manifest = await fetchManifest(
        app.registry,
        c.req.param('org'),
        c.req.param('slug'),
        c.req.param('ver'),
      );
      return withEtag(c, manifest);
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.get('/registry/:org/:slug/install', async (c) => {
    const app = ctx;
    const harness = (c.req.query('harness') ?? 'cursor') as 'cursor' | 'claude-desktop' | 'generic';
    const versionParam = c.req.query('version');

    try {
      const mcp = await app.registryStore.getMcp(c.req.param('org'), c.req.param('slug'));
      if (!mcp) {
        return notFound(c, 'MCP not found');
      }

      const version = versionParam
        ? await app.registryStore.getVersion(c.req.param('org'), c.req.param('slug'), versionParam)
        : await app.registryStore.getLatestPublishedVersion(mcp.id);

      if (!version) {
        return notFound(c, 'Published version not found');
      }

      const stored = await app.registryStore.getManifestById(version.manifestId);
      if (!stored) {
        return notFound(c, 'Manifest not found');
      }

      const snippet = buildInstallSnippet(
        { org: c.req.param('org'), slug: c.req.param('slug') },
        version.version,
        stored.content,
        { registryBaseUrl: app.config.baseUrl, harness },
      );

      return withEtag(c, { harness, snippet });
    } catch (error) {
      if (error instanceof RegistryError) {
        return handleRegistryError(c, error);
      }
      throw error;
    }
  });

  routes.get('/search', async (c) => {
    const app = ctx;
    const q = c.req.query('q') ?? undefined;
    const tag = c.req.query('tag');
    const capability = c.req.query('capability') ?? undefined;
    const cursor = c.req.query('cursor') ?? undefined;
    const limit = c.req.query('limit') ? Number(c.req.query('limit')) : undefined;

    const result = await searchCatalog(app.registry, {
      query: q,
      tags: tag ? [tag] : undefined,
      capability,
      cursor,
      limit,
    });

    return withEtag(c, result);
  });

  return routes;
}
