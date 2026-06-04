import type { ManifestTool } from '@mcp-definer/schemas';

import { UpstreamHttpError } from './errors.js';
import type { HttpResponse } from './execute-http.js';

export interface ToolCallResult {
  ok: boolean;
  status: number;
  data: unknown;
  text: string;
}

function isSuccessStatus(status: number, successStatus: string[]): boolean {
  return successStatus.includes(String(status));
}

export function shapeResponse(tool: ManifestTool, response: HttpResponse): ToolCallResult {
  const success = isSuccessStatus(response.status, tool.response.successStatus);

  if (!success) {
    const behavior = tool.response.errorMap.default ?? 'raise';
    if (behavior === 'raise') {
      throw new UpstreamHttpError(
        `Upstream API returned HTTP ${response.status}`,
        response.status,
        response.body,
      );
    }
  }

  switch (tool.response.shape) {
    case 'passthrough':
      return {
        ok: success,
        status: response.status,
        data: response.body,
        text: response.text,
      };
    case 'summarize':
      return {
        ok: success,
        status: response.status,
        data: {
          summary: typeof response.text === 'string' ? response.text.slice(0, 500) : response.body,
          truncated: response.text.length > 500,
        },
        text: response.text.slice(0, 500),
      };
    case 'jsonpath':
      return {
        ok: success,
        status: response.status,
        data: response.body,
        text: response.text,
      };
    default:
      return {
        ok: success,
        status: response.status,
        data: response.body,
        text: response.text,
      };
  }
}
