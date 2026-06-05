import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { RegistryError } from '@mcp-definer/registry';

import {
  badRequest,
  conflict,
  forbidden,
  handleRegistryError,
  notFound,
  problem,
  unauthorized,
} from './errors.js';

describe('API problem helpers', () => {
  it('problem builds RFC7807-shaped payload', () => {
    const body = problem(400, 'BAD_REQUEST', 'Invalid', 'BAD_REQUEST', [
      { path: '/name', message: 'required' },
    ]);
    expect(body.status).toBe(400);
    expect(body.errors).toHaveLength(1);
  });

  it('notFound returns 404 JSON', async () => {
    const app = new Hono();
    app.get('/test', (c) => notFound(c, 'missing'));
    const res = await app.request('/test');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });

  it('unauthorized and forbidden return expected codes', async () => {
    const app = new Hono();
    app.get('/u', (c) => unauthorized(c));
    app.get('/f', (c) => forbidden(c, 'nope'));
    expect((await app.request('/u')).status).toBe(401);
    expect(((await (await app.request('/f')).json()) as { code: string }).code).toBe('FORBIDDEN');
  });

  it('badRequest and conflict include detail', async () => {
    const app = new Hono();
    app.get('/b', (c) => badRequest(c, 'bad'));
    app.get('/c', (c) => conflict(c, 'dup'));
    expect((await app.request('/b')).status).toBe(400);
    expect((await app.request('/c')).status).toBe(409);
  });

  it('handleRegistryError maps RegistryError status', async () => {
    const app = new Hono();
    app.get('/r', (c) => handleRegistryError(c, new RegistryError('CONFLICT', 'exists')));
    const res = await app.request('/r');
    expect(res.status).toBe(409);
  });
});
