#!/usr/bin/env node
/**
 * Cross-package contract tests (A1 schema contracts; A9 adds E2E later).
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function runNode(args) {
  const node = process.execPath;
  const result = spawnSync(node, args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('=== Contract tests: @mcp-definer/schemas ===');
runNode([
  join(repoRoot, 'node_modules/vitest/vitest.mjs'),
  'run',
  'packages/schemas/src/contract.test.ts',
]);

console.log('\n=== Contract tests: schema build ===');
runNode([
  join(repoRoot, 'node_modules/typescript/bin/tsc'),
  '-p',
  join(repoRoot, 'packages/schemas/tsconfig.json'),
]);

console.log('\n=== Contract tests: @mcp-definer/generator (golden files) ===');
runNode([
  join(repoRoot, 'node_modules/vitest/vitest.mjs'),
  'run',
  'packages/generator/src/contract.test.ts',
]);

console.log('\n=== Contract tests: @mcp-definer/request-pipeline ===');
runNode([
  join(repoRoot, 'node_modules/vitest/vitest.mjs'),
  'run',
  'packages/request-pipeline/src/request-pipeline.test.ts',
]);

console.log('\n=== Contract tests: API discovery + credentials + determinism ===');
runNode([
  join(repoRoot, 'node_modules/vitest/vitest.mjs'),
  'run',
  'packages/api/src/contract.test.ts',
]);

console.log('\nContract tests passed.');
