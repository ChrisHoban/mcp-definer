import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

export interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

export interface MockUpstream {
  baseUrl: string;
  port: number;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}

export interface MockUpstreamOptions {
  /** HTTP response status (default 200). */
  status?: number;
  /** JSON response body (default `{ id: 1, name: 'doggie', status: 'available' }`). */
  body?: unknown;
}

/**
 * Local mock Petstore upstream for integration/E2E (no external network).
 */
export async function startMockUpstream(options: MockUpstreamOptions = {}): Promise<MockUpstream> {
  const requests: CapturedRequest[] = [];
  const status = options.status ?? 200;
  const body = options.body ?? {
    id: 1,
    name: 'doggie',
    status: 'available',
    photoUrls: [],
    tags: [],
  };

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    requests.push({
      method: req.method ?? 'GET',
      url,
      headers: { ...req.headers },
    });

    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  });

  await new Promise<void>((resolve, reject) => {
    server.listen(0, '127.0.0.1', (error?: Error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind mock upstream');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    port: address.port,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export function withMockEgress<
  T extends { targetApi: { baseUrl: string }; policies: { egressAllowlist: string[] } },
>(manifest: T, mockBaseUrl: string): T {
  const host = new URL(mockBaseUrl).hostname;
  const allowlist = new Set(manifest.policies.egressAllowlist);
  allowlist.add(host);
  allowlist.add('127.0.0.1');
  allowlist.add('localhost');

  return {
    ...manifest,
    targetApi: {
      ...manifest.targetApi,
      baseUrl: mockBaseUrl,
    },
    policies: {
      ...manifest.policies,
      egressAllowlist: [...allowlist],
    },
  };
}
