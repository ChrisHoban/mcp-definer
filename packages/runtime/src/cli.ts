#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadManifest, ManifestLoadError, resolveManifestSource } from './manifest-loader.js';
import { serveStdio } from './server.js';

export function parseArgs(argv: string[]): { manifest?: string } {
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

export async function runRuntimeCli(argv: string[]): Promise<void> {
  const args = parseArgs(argv);
  const source = resolveManifestSource(args.manifest);
  const manifest = await loadManifest(source);
  await serveStdio(manifest);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return resolve(fileURLToPath(import.meta.url)) === resolve(entry);
}

if (isDirectRun()) {
  runRuntimeCli(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof ManifestLoadError) {
      console.error(`[ERROR] ${error.message}`);
      process.exit(1);
    }

    console.error('[ERROR] Fatal runtime error:', error);
    process.exit(1);
  });
}
