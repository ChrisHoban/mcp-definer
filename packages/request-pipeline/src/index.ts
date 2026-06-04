import { applyCredential, type ResolvedCredential } from '@mcp-definer/auth';
import type { Manifest, ManifestTool } from '@mcp-definer/schemas';

import { buildHttpRequest } from './build-request.js';
import { assertEgressAllowed } from './egress.js';
import { defaultHttpFetch, executeHttpWithRetries, type HttpFetchFn } from './execute-http.js';
import { redactHttpRequest, redactText } from './redact.js';
import { shapeResponse, type ToolCallResult } from './shape-response.js';
import { validateToolArgs } from './validate-args.js';

export type { ToolCallResult } from './shape-response.js';
export type { HttpFetchFn, HttpResponse } from './execute-http.js';
export {
  ToolValidationError,
  EgressBlockedError,
  UpstreamHttpError,
  PipelineError,
} from './errors.js';
export { validateToolArgs } from './validate-args.js';
export { buildHttpRequest } from './build-request.js';
export { assertEgressAllowed } from './egress.js';
export { redactHttpRequest, redactText } from './redact.js';

export interface ExecuteToolCallOptions {
  baseUrlOverride?: string;
  fetch?: HttpFetchFn;
  onRequest?: (request: Record<string, unknown>) => void;
}

export async function executeToolCall(
  manifest: Manifest,
  tool: ManifestTool,
  args: unknown,
  credential: ResolvedCredential,
  options: ExecuteToolCallOptions = {},
): Promise<ToolCallResult> {
  validateToolArgs(tool.inputSchema, args);

  const request = buildHttpRequest(
    manifest,
    tool,
    args as Record<string, unknown>,
    options.baseUrlOverride,
  );
  const authedRequest = applyCredential(credential, request);

  assertEgressAllowed(authedRequest.url, manifest.policies.egressAllowlist);

  options.onRequest?.(redactHttpRequest(authedRequest, credential));

  const response = await executeHttpWithRetries(
    authedRequest,
    manifest.policies,
    options.fetch ?? defaultHttpFetch,
  );

  const result = shapeResponse(tool, response);

  return {
    ...result,
    text: redactText(result.text, credential),
  };
}
