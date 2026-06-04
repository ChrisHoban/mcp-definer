import type { Context } from 'hono';
import { RegistryError } from '@mcp-definer/registry';

export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  code?: string;
  errors?: Array<{ path: string; message: string; code?: string }>;
}

export function problem(
  status: number,
  title: string,
  detail: string,
  code?: string,
  errors?: ProblemDetail['errors'],
): ProblemDetail {
  return {
    type: 'about:blank',
    title,
    status,
    detail,
    code,
    errors,
  };
}

export function sendProblem(c: Context, body: ProblemDetail) {
  return c.json(body, body.status as 401 | 403 | 404 | 409 | 400 | 500);
}

export function handleRegistryError(c: Context, error: RegistryError) {
  return sendProblem(
    c,
    problem(error.statusCode, error.code, error.message, error.code),
  );
}

export function notFound(c: Context, detail: string) {
  return sendProblem(c, problem(404, 'NOT_FOUND', detail, 'NOT_FOUND'));
}

export function conflict(c: Context, detail: string) {
  return sendProblem(c, problem(409, 'CONFLICT', detail, 'CONFLICT'));
}

export function forbidden(c: Context, detail = 'Forbidden') {
  return sendProblem(c, problem(403, 'FORBIDDEN', detail, 'FORBIDDEN'));
}

export function unauthorized(c: Context, detail = 'Unauthorized') {
  return sendProblem(c, problem(401, 'UNAUTHORIZED', detail, 'UNAUTHORIZED'));
}

export function badRequest(c: Context, detail: string, errors?: ProblemDetail['errors']) {
  return sendProblem(c, problem(400, 'BAD_REQUEST', detail, 'BAD_REQUEST', errors));
}
