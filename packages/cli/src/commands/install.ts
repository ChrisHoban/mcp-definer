import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { secretEnvVarName } from '@mcp-definer/auth';
import {
  buildInstallSnippet,
  createSeededRegistryStore,
  fetchManifest,
  getRegistryDetail,
  InMemoryRegistryStore,
  RegistryError,
  type RegistryContext,
} from '@mcp-definer/registry';

import {
  defaultMcpConfigPath,
  mergeMcpServer,
  readMcpConfig,
  writeMcpConfig,
} from '../mcp-config.js';

export interface InstallOptions {
  harness?: 'cursor' | 'claude-desktop' | 'generic';
  registryUrl?: string;
  configPath?: string;
  local?: boolean;
  yes?: boolean;
  /** Inject registry store (E2E / integration tests). */
  testRegistryStore?: InMemoryRegistryStore;
}

interface ParsedRef {
  org: string;
  slug: string;
  version?: string;
}

function parseMcpRef(arg: string): ParsedRef | null {
  const match = /^([^/]+)\/([^/@]+)(?:@(.+))?$/.exec(arg);
  if (!match) {
    return null;
  }
  return { org: match[1], slug: match[2], version: match[3] };
}

async function promptSecret(envVar: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`Enter value for ${envVar}: `);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function resolveInstallContext(options: InstallOptions): Promise<{
  ctx: RegistryContext;
  registryBaseUrl: string;
}> {
  if (options.testRegistryStore) {
    return {
      ctx: { store: options.testRegistryStore, baseUrl: '/v1' },
      registryBaseUrl: options.registryUrl ?? 'http://localhost:3001/v1',
    };
  }

  if (options.local) {
    const store = await createSeededRegistryStore();
    return { ctx: { store, baseUrl: '/v1' }, registryBaseUrl: options.registryUrl ?? '/v1' };
  }

  throw new RegistryError(
    'NOT_FOUND',
    'Remote install requires --local for offline mode or a running registry API (A6)',
  );
}

export async function runInstall(args: string[], options: InstallOptions = {}): Promise<number> {
  const refArg = args[0];
  if (!refArg) {
    console.error('Usage: mcp-definer install <org/slug[@version]> [--harness cursor] [--local]');
    return 1;
  }

  const ref = parseMcpRef(refArg);
  if (!ref) {
    console.error(`Invalid MCP reference: ${refArg}. Expected org/slug or org/slug@version`);
    return 1;
  }

  const harness = options.harness ?? 'cursor';
  const configPath = options.configPath ?? defaultMcpConfigPath();

  try {
    const { ctx, registryBaseUrl } = await resolveInstallContext(options);

    const detail = await getRegistryDetail(ctx, ref.org, ref.slug);
    const version = ref.version ?? detail.latestVersion;
    if (!version) {
      console.error(`No published version for ${ref.org}/${ref.slug}`);
      return 1;
    }

    const manifest = await fetchManifest(ctx, ref.org, ref.slug, version);
    const snippet = buildInstallSnippet({ org: ref.org, slug: ref.slug }, version, manifest, {
      registryBaseUrl,
      harness,
    });

    const envVar = secretEnvVarName(manifest.auth.bindingId);
    const placeholder = snippet.env[envVar] ?? '<user-supplied at install>';
    let secretValue: string;
    if (options.yes) {
      // Never embed live secrets when skipping prompts (ADR-004).
      secretValue = placeholder;
      if (!process.env[envVar]) {
        console.warn(`Warning: ${envVar} not set — runtime will fail until you configure it.`);
      }
    } else if (process.env[envVar]) {
      secretValue = process.env[envVar]!;
    } else {
      secretValue = await promptSecret(envVar);
    }
    if (!secretValue) {
      secretValue = placeholder;
      console.warn(`Warning: ${envVar} not set — runtime will fail until you configure it.`);
    }

    const serverName = ref.slug;
    const config = await readMcpConfig(configPath);
    const merged = mergeMcpServer(config, serverName, {
      command: snippet.command,
      args: snippet.args,
      env: {
        ...snippet.env,
        [envVar]: secretValue,
      },
    });

    await writeMcpConfig(configPath, merged);

    console.log(`Installed ${ref.org}/${ref.slug}@${version} into ${configPath}`);
    console.log(`  server key: ${serverName}`);
    console.log(`  manifest: ${snippet.args[snippet.args.length - 1]}`);
    return 0;
  } catch (error) {
    if (error instanceof RegistryError) {
      console.error(error.message);
      return 1;
    }
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}
