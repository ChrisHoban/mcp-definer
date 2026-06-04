import { createHash } from 'node:crypto';

import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';

export function computeEtag(body: unknown): string {
  const json = typeof body === 'string' ? body : JSON.stringify(body);
  const hash = createHash('sha256').update(json).digest('hex');
  return `"${hash}"`;
}

export function withEtag(c: Context, body: unknown, status = 200) {
  const etag = computeEtag(body);
  const ifNoneMatch = c.req.header('If-None-Match');
  c.header('ETag', etag);
  c.header('Cache-Control', 'public, max-age=60');

  if (ifNoneMatch === etag) {
    return c.body(null, 304);
  }

  return c.json(body, status as 200);
}

export const etagMiddleware = createMiddleware(async (c, next) => {
  await next();
});
