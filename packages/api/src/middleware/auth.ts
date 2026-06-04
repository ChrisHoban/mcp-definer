import { createMiddleware } from 'hono/factory';

import { hasPermission, type Permission } from '@mcp-definer/auth';

import type { AppContext, AuthContext } from '../context.js';
import { forbidden, unauthorized } from '../errors.js';

export type ApiEnv = {
  Variables: {
    auth: AuthContext;
    app: AppContext;
  };
};

function parseAuthHeader(header: string | undefined, expectedKey: string): boolean {
  if (!header) {
    return false;
  }
  if (header === expectedKey) {
    return true;
  }
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length) === expectedKey;
  }
  return false;
}

export function authMiddleware(app: AppContext) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    c.set('app', app);

    const apiKey = c.req.header('X-API-Key');
    const authHeader = c.req.header('Authorization');
    const token = apiKey ?? authHeader;

    if (!parseAuthHeader(token, app.config.apiKey)) {
      return unauthorized(c, 'Invalid or missing API key. Use X-API-Key or Authorization: Bearer.');
    }

    c.set('auth', {
      userId: app.tenancy.userId,
      orgId: app.tenancy.orgId,
      orgSlug: app.tenancy.orgSlug,
      role: app.config.defaultRole,
    });

    await next();
  });
}

export function requirePermission(permission: Permission) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    const auth = c.get('auth');
    if (!hasPermission(auth.role, permission)) {
      return forbidden(c, `Missing permission: ${permission}`);
    }
    await next();
  });
}

/** Optional auth for discovery — attaches auth when present, never blocks. */
export function optionalAuthMiddleware(app: AppContext) {
  return createMiddleware<ApiEnv>(async (c, next) => {
    c.set('app', app);

    const apiKey = c.req.header('X-API-Key');
    const authHeader = c.req.header('Authorization');
    const token = apiKey ?? authHeader;

    if (parseAuthHeader(token, app.config.apiKey)) {
      c.set('auth', {
        userId: app.config.defaultUserId,
        orgId: app.config.defaultOrgId,
        orgSlug: app.config.defaultOrgSlug,
        role: app.config.defaultRole,
      });
    }

    await next();
  });
}
