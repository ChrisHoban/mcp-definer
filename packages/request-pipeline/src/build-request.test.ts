import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Manifest } from '@mcp-definer/schemas';
import { describe, expect, it } from 'vitest';

import { buildHttpRequest } from './build-request.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');

function loadManifest(): Manifest {
  return JSON.parse(
    readFileSync(join(repoRoot, 'fixtures/manifests/petstore-apikey.manifest.json'), 'utf8'),
  ) as Manifest;
}

describe('buildHttpRequest', () => {
  it('builds path and query string from tool param map', () => {
    const manifest = loadManifest();
    const tool = manifest.tools.find((entry) => entry.name === 'findPetsByStatus')!;

    const request = buildHttpRequest(manifest, tool, {
      status: ['available', 'pending'],
    });

    expect(request.url).toBe(
      'https://petstore.swagger.io/v2/pet/findByStatus?status=available,pending',
    );
    expect(request.method).toBe('GET');
  });

  it('throws when required path parameter is missing', () => {
    const manifest = loadManifest();
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;

    expect(() => buildHttpRequest(manifest, tool, {})).toThrow(/Missing required path parameter/);
  });

  it('honors baseUrlOverride', () => {
    const manifest = loadManifest();
    const tool = manifest.tools.find((entry) => entry.name === 'getPetById')!;

    const request = buildHttpRequest(manifest, tool, { petId: 7 }, 'https://custom.example/v2/');
    expect(request.url).toBe('https://custom.example/v2/pet/7');
  });
});
