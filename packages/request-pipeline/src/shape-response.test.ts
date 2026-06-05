import type { ManifestTool } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { UpstreamHttpError } from './errors.js';
import type { HttpResponse } from './execute-http.js';
import { shapeResponse } from './shape-response.js';

const tool: ManifestTool = {
  name: 'getPet',
  description: 'Get pet',
  enabled: true,
  inputSchema: { type: 'object' },
  request: {
    method: 'GET',
    pathTemplate: '/pet/{id}',
    paramMap: { id: { in: 'path' } },
    bodyParam: null,
  },
  response: {
    successStatus: ['200'],
    shape: 'passthrough',
    errorMap: { default: 'raise' },
  },
};

function response(overrides: Partial<HttpResponse> = {}): HttpResponse {
  return {
    status: 200,
    headers: {},
    body: { id: 1 },
    text: '{"id":1}',
    ...overrides,
  };
}

describe('shapeResponse', () => {
  it('returns passthrough data on success', () => {
    const result = shapeResponse(tool, response());
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 1 });
  });

  it('throws UpstreamHttpError on failure when errorMap is raise', () => {
    expect(() => shapeResponse(tool, response({ status: 500, body: null, text: '' }))).toThrow(
      UpstreamHttpError,
    );
  });

  it('summarize shape truncates long text', () => {
    const longText = 'x'.repeat(600);
    const summarizeTool: ManifestTool = {
      ...tool,
      response: { ...tool.response, shape: 'summarize' },
    };
    const result = shapeResponse(summarizeTool, response({ text: longText, body: longText }));
    expect(result.data).toMatchObject({ truncated: true });
    expect((result.data as { summary: string }).summary.length).toBeLessThanOrEqual(500);
  });
});
