import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import {
  EnvCredentialResolver,
  EnvSecretStore,
  InMemoryBindingStore,
  type CredentialResolver,
} from '@mcp-definer/auth';
import type { Manifest, ManifestTool } from '@mcp-definer/schemas';
import {
  EgressBlockedError,
  executeToolCall,
  ToolValidationError,
  UpstreamHttpError,
} from '@mcp-definer/request-pipeline';

import { createLogger, type RuntimeLogger } from './logger.js';

export interface RuntimeServerOptions {
  manifest: Manifest;
  credentialResolver?: CredentialResolver;
  logger?: RuntimeLogger;
}

function enabledTools(manifest: Manifest): ManifestTool[] {
  return manifest.tools.filter((tool) => tool.enabled);
}

function findTool(manifest: Manifest, name: string): ManifestTool | undefined {
  return enabledTools(manifest).find((tool) => tool.name === name);
}

function createDefaultResolver(manifest: Manifest): EnvCredentialResolver {
  const manifestAuthByBindingId = new Map([[manifest.auth.bindingId, manifest.auth]]);
  const secretStore = new EnvSecretStore();
  return new EnvCredentialResolver({
    bindingStore: new InMemoryBindingStore(secretStore),
    secretStore,
    manifestAuthByBindingId,
  });
}

function toolResultText(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data, null, 2);
}

function mcpError(message: string, code: number): Error {
  const error = new Error(message) as Error & { code?: number };
  error.code = code;
  return error;
}

export function createRuntimeServer(options: RuntimeServerOptions): Server {
  const { manifest } = options;
  const resolver = options.credentialResolver ?? createDefaultResolver(manifest);
  const logger = options.logger ?? createLogger();

  const server = new Server(
    {
      name: manifest.name,
      version: manifest.manifestSchemaVersion,
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: enabledTools(manifest).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: manifest.resources.map((resource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = manifest.resources.find((entry) => entry.uri === request.params.uri);
    if (!resource) {
      throw mcpError(`Unknown resource: ${request.params.uri}`, -32602);
    }

    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType ?? 'text/plain',
          text: resource.description,
        },
      ],
    };
  });

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: manifest.prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const prompt = manifest.prompts.find((entry) => entry.name === request.params.name);
    if (!prompt) {
      throw mcpError(`Unknown prompt: ${request.params.name}`, -32602);
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt.description,
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = findTool(manifest, request.params.name);
    if (!tool) {
      throw mcpError(`Unknown tool: ${request.params.name}`, -32602);
    }

    const correlationId = crypto.randomUUID();
    logger.info('tool.call.start', {
      correlationId,
      tool: tool.name,
      manifest: manifest.name,
    });

    try {
      const credential = await resolver.resolve(manifest.auth.bindingId);
      const authedLogger = options.logger ?? createLogger(credential);

      const result = await executeToolCall(
        manifest,
        tool,
        request.params.arguments ?? {},
        credential,
        {
          onRequest: (outbound) => {
            authedLogger.info('tool.call.outbound', {
              correlationId,
              tool: tool.name,
              request: outbound,
            });
          },
        },
      );

      authedLogger.info('tool.call.success', {
        correlationId,
        tool: tool.name,
        status: result.status,
      });

      return {
        content: [
          {
            type: 'text',
            text: toolResultText(result.data),
          },
        ],
      };
    } catch (error: unknown) {
      if (error instanceof ToolValidationError) {
        logger.error('tool.call.validation_failed', {
          correlationId,
          tool: tool.name,
          issues: error.issues,
        });
        throw mcpError(`Invalid arguments: ${error.issues.join('; ')}`, -32602);
      }

      if (error instanceof EgressBlockedError) {
        logger.error('tool.call.egress_blocked', {
          correlationId,
          tool: tool.name,
          host: error.host,
        });
        throw mcpError(error.message, -32603);
      }

      if (error instanceof UpstreamHttpError) {
        logger.error('tool.call.upstream_error', {
          correlationId,
          tool: tool.name,
          status: error.status,
        });
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: toolResultText(error.body),
            },
          ],
        };
      }

      logger.error('tool.call.failed', {
        correlationId,
        tool: tool.name,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  });

  return server;
}

export async function serveStdio(manifest: Manifest, resolver?: CredentialResolver): Promise<void> {
  const server = createRuntimeServer({ manifest, credentialResolver: resolver });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
