import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeCanonical, validateManifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { applyCuration, emptyCuration, mapIrToManifest, parseSpec } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const petstoreSpec = join(repoRoot, 'fixtures/openapi/petstore.yaml');
const goldenPath = join(repoRoot, 'fixtures/golden/petstore.manifest.json');

const MAP_OPTIONS = {
  name: 'petstore',
  displayName: 'Petstore API',
  description: 'MCP for the Petstore API',
  authBindingId: 'cb_petstore_apikey',
  securityScheme: 'api_key',
};

async function compilePetstore() {
  const { ir } = await parseSpec({ kind: 'file', path: petstoreSpec });
  const draft = mapIrToManifest(ir, MAP_OPTIONS);
  return applyCuration(draft, emptyCuration(), ir);
}

describe('contract: generator golden files', () => {
  it('petstore.yaml + empty curation matches fixtures/golden/petstore.manifest.json', async () => {
    const manifest = await compilePetstore();
    const result = validateManifest(manifest);
    expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);

    const expected = JSON.parse(readFileSync(goldenPath, 'utf8')) as unknown;
    expect(serializeCanonical(manifest)).toBe(serializeCanonical(expected));
  });

  it('same input run twice yields byte-identical output (NFR-06)', async () => {
    const first = serializeCanonical(await compilePetstore());
    const second = serializeCanonical(await compilePetstore());
    expect(first).toBe(second);
  });
});
