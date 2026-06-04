import type { HttpRequest } from '../types/http.js';
import type { ResolvedCredential } from './resolved-credential.js';

function cloneRequest(request: HttpRequest): HttpRequest {
  return {
    ...request,
    headers: { ...request.headers },
    query: request.query ? { ...request.query } : undefined,
  };
}

/** Apply a resolved credential to an outbound HTTP request (no secret logging). */
export function applyCredential(
  credential: ResolvedCredential,
  request: HttpRequest,
): HttpRequest {
  const next = cloneRequest(request);

  switch (credential.authType) {
    case 'apiKey': {
      const { in: location, name } = credential.apply;
      if (location === 'header') {
        next.headers[name] = credential.value;
      } else {
        next.query = { ...next.query, [name]: credential.value };
      }
      break;
    }
    case 'bearer': {
      const headerName = credential.apply.headerName ?? 'Authorization';
      const prefix = credential.apply.prefix ?? 'Bearer';
      next.headers[headerName] = `${prefix} ${credential.token}`.trim();
      break;
    }
    case 'basic': {
      const encoded = Buffer.from(`${credential.username}:${credential.password}`).toString(
        'base64',
      );
      next.headers['Authorization'] = `Basic ${encoded}`;
      break;
    }
    case 'custom': {
      for (const [name, value] of Object.entries(credential.apply.headers)) {
        const resolved = credential.headerValues[name] ?? value;
        next.headers[name] = resolved;
      }
      for (const [name, value] of Object.entries(credential.headerValues)) {
        if (!(name in credential.apply.headers)) {
          next.headers[name] = value;
        }
      }
      break;
    }
    case 'oauth2_cc': {
      next.headers['Authorization'] = `Bearer ${credential.accessToken}`;
      break;
    }
    default: {
      const _exhaustive: never = credential;
      throw new Error(`Unsupported auth type: ${(_exhaustive as ResolvedCredential).authType}`);
    }
  }

  return next;
}
