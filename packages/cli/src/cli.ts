#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runValidate } from './commands/validate.js';

export function parseArgs(argv: string[]): {
  command: string | undefined;
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!command && !arg.startsWith('-')) {
      command = arg;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(arg);
  }

  return { command, positional, flags };
}

export async function runCli(argv: string[]): Promise<number> {
  const { command, positional, flags } = parseArgs(argv);

  switch (command) {
    case 'install':
      return runInstall(positional, {
        harness: flags.harness as string | undefined as 'cursor' | undefined,
        registryUrl: flags['registry-url'] as string | undefined,
        configPath: flags.config as string | undefined,
        local: flags.local === true,
        yes: flags.yes === true,
      });
    case 'list':
      return runList(positional, {
        registryUrl: flags['registry-url'] as string | undefined,
        local: flags.local === true,
      });
    case 'validate':
      return runValidate(positional);
    case undefined:
      console.log(`Usage: mcp-definer <command>

Commands:
  install <org/slug[@version]>  Install MCP into Cursor mcp.json
  list                          Browse discovery catalog
  validate <manifest.json>      Validate a manifest file

Options:
  --local                       Use local fixture catalog (dev)
  --harness cursor              Harness target for install (default: cursor)
  --registry-url <url>          Registry API base URL
  --config <path>               Cursor mcp.json path
  --yes                         Skip secret prompt (use env or placeholder)
`);
      return 1;
    default:
      console.error(`Unknown command: ${command}`);
      return 1;
  }
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
}

if (isDirectRun()) {
  runCli(process.argv.slice(2))
    .then((exitCode) => process.exit(exitCode))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
