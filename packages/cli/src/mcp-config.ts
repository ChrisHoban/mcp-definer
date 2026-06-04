import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface CursorMcpConfig {
  mcpServers?: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
}

export function defaultMcpConfigPath(): string {
  if (process.env.CURSOR_MCP_CONFIG) {
    return process.env.CURSOR_MCP_CONFIG;
  }
  return join(homedir(), '.cursor', 'mcp.json');
}

export async function readMcpConfig(path: string): Promise<CursorMcpConfig> {
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw) as CursorMcpConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { mcpServers: {} };
    }
    throw error;
  }
}

export async function writeMcpConfig(path: string, config: CursorMcpConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function mergeMcpServer(
  config: CursorMcpConfig,
  serverName: string,
  serverConfig: NonNullable<CursorMcpConfig['mcpServers']>[string],
): CursorMcpConfig {
  return {
    ...config,
    mcpServers: {
      ...config.mcpServers,
      [serverName]: serverConfig,
    },
  };
}
