import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serializeCanonical, validateManifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import {
  applyCuration,
  emptyCuration,
  mapIrToManifest,
  parseSpec,
  regenerateWithDiff,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const fixturesOpenapi = join(repoRoot, 'fixtures/openapi');

const MAP_OPTIONS = {
  name: 'petstore',
  authBindingId: 'cb_petstore_apikey',
  securityScheme: 'api_key',
};

describe('parseSpec', () => {
  it('parses Swagger 2 petstore with expected operation count', async () => {
    const { ir, format } = await parseSpec({
      kind: 'file',
      path: join(fixturesOpenapi, 'petstore.yaml'),
    });
    expect(format).toBe('swagger2');
    expect(ir.operations.length).toBeGreaterThan(10);
    expect(ir.source.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('derives operation id when operationId is missing (messy-spec)', async () => {
    const { ir } = await parseSpec({
      kind: 'file',
      path: join(fixturesOpenapi, 'messy-spec.yaml'),
    });
    expect(ir.operations.some((o) => o.id === 'getItems')).toBe(true);
  });
});

describe('mapIrToManifest + applyCuration', () => {
  it('applies petstore curation fixture (filters + descriptions)', async () => {
    const { ir } = await parseSpec({
      kind: 'file',
      path: join(fixturesOpenapi, 'petstore.yaml'),
    });
    const curation = JSON.parse(
      readFileSync(join(repoRoot, 'fixtures/curation/petstore.curation.json'), 'utf8'),
    );
    const draft = mapIrToManifest(ir, MAP_OPTIONS);
    const manifest = applyCuration(draft, curation, ir);

    expect(manifest.tools.some((t) => t.name === 'getPetById')).toBe(true);
    expect(manifest.tools.some((t) => t.name === 'findPetsByStatus')).toBe(true);
    expect(manifest.tools.some((t) => t.name === 'deletePet')).toBe(false);
    expect(manifest.tools.find((t) => t.name === 'getPetById')?.description).toBe(
      'Fetch a pet by ID for the agent.',
    );
    expect(manifest.tools.find((t) => t.name === 'getPetById')?.group).toBe('pets');

    const validation = validateManifest(manifest);
    expect(validation.valid, JSON.stringify(validation.errors)).toBe(true);
  });
});

describe('regenerateWithDiff', () => {
  it('reports added and removed tools when spec changes', async () => {
    const base = await parseSpec({
      kind: 'file',
      path: join(fixturesOpenapi, 'messy-spec.yaml'),
    });
    const previousManifest = mapIrToManifest(base.ir, { name: 'messy' });

    const newIr = {
      ...base.ir,
      operations: base.ir.operations.filter((o) => o.id !== 'getItems'),
    };

    const { diff, manifest } = regenerateWithDiff({
      previousIr: base.ir,
      previousManifest,
      newIr,
      curation: emptyCuration(),
      mapOptions: { name: 'messy' },
    });

    expect(diff.removed.some((r) => r.operationId === 'getItems')).toBe(true);
    expect(validateManifest(manifest).valid).toBe(true);
  });
});

describe('determinism', () => {
  it('canonical serialization is stable across map + curation', async () => {
    const { ir } = await parseSpec({
      kind: 'file',
      path: join(fixturesOpenapi, 'large-api.yaml'),
    });
    const manifest = applyCuration(mapIrToManifest(ir, { name: 'large' }), emptyCuration(), ir);
    const once = serializeCanonical(manifest);
    const twice = serializeCanonical(
      applyCuration(mapIrToManifest(ir, { name: 'large' }), emptyCuration(), ir),
    );
    expect(once).toBe(twice);
  });
});
