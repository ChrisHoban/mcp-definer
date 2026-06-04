import { describe, expect, it } from 'vitest';

import { authHeaders, createTestApp, loadRepoText } from '../helpers/test-app.js';

const PETSTORE_OPERATION_COUNT = 20;

describe('integration: parse pipeline', () => {
  it('POST /v1/specs/parse returns IR with expected operation count', async () => {
    const { app } = await createTestApp();
    const spec = loadRepoText('fixtures/openapi/petstore.yaml');

    const res = await app.request('http://localhost/v1/specs/parse', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        content: spec,
        filename: 'petstore.yaml',
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ir: { operations: unknown[] };
      format: string;
      operationCount: number;
    };

    expect(body.format).toBe('swagger2');
    expect(body.operationCount).toBe(PETSTORE_OPERATION_COUNT);
    expect(body.ir.operations).toHaveLength(PETSTORE_OPERATION_COUNT);
  });
});
