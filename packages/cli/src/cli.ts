#!/usr/bin/env node

import { runInstall } from './commands/install.js';
import { runList } from './commands/list.js';
import { runValidate } from './commands/validate.js';

function parseArgs(argv: string[]): {
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

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv.slice(2));

  let exitCode = 0;
  switch (command) {
    case 'install':
      exitCode = await runInstall(positional, {
        harness: flags.harness as string | undefined as 'cursor' | undefined,
        registryUrl: flags['registry-url'] as string | undefined,
        configPath: flags.config as string | undefined,
        local: flags.local === true,
        yes: flags.yes === true,
      });
      break;
    case 'list':
      exitCode = await runList(positional, {
        registryUrl: flags['registry-url'] as string | undefined,
        local: flags.local === true,
      });
      break;
    case 'validate':
      exitCode = await runValidate(positional);
      break;
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
      exitCode = 1;
      break;
    default:
      console.error(`Unknown command: ${command}`);
      exitCode = 1;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
