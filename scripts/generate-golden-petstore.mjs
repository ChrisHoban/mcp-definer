#!/usr/bin/env node
/**
 * (Re)generate fixtures/golden/petstore.manifest.json from fixtures/openapi/petstore.yaml.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const petstoreYaml = join(repoRoot, 'fixtures/openapi/petstore.yaml');

const { parseSpec, mapIrToManifest, applyCuration, emptyCuration } =
  await import('../packages/generator/dist/index.js');
const { serializeCanonical } = await import('../packages/schemas/dist/index.js');

const { ir } = await parseSpec({ kind: 'file', path: petstoreYaml });
const draft = mapIrToManifest(ir, {
  name: 'petstore',
  displayName: 'Petstore API',
  description: 'MCP for the Petstore API',
  authBindingId: 'cb_petstore_apikey',
  securityScheme: 'api_key',
});
const manifest = applyCuration(draft, emptyCuration(), ir);

const goldenDir = join(repoRoot, 'fixtures/golden');
mkdirSync(goldenDir, { recursive: true });
const goldenPath = join(goldenDir, 'petstore.manifest.json');
writeFileSync(goldenPath, `${serializeCanonical(manifest)}\n`, 'utf8');
console.log('Wrote', goldenPath);
