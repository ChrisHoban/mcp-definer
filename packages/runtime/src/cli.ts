#!/usr/bin/env node

import { loadManifest, ManifestLoadError, resolveManifestSource } from './manifest-loader.js';
import { serveStdio } from './server.js';

function parseArgs(argv: string[]): { manifest?: string } {
  const result: { manifest?: string } = {};

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--manifest') {
      result.manifest = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--manifest=')) {
      result.manifest = arg.slice('--manifest='.length);
    }
  }

  return result;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const source = resolveManifestSource(args.manifest);
  const manifest = await loadManifest(source);
  await serveStdio(manifest);
}

main().catch((error: unknown) => {
  if (error instanceof ManifestLoadError) {
    console.error(`[ERROR] ${error.message}`);
    process.exit(1);
  }

  console.error('[ERROR] Fatal runtime error:', error);
  process.exit(1);
});
