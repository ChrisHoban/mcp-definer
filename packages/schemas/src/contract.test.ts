import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  roundTripDeterministic,
  serializeCanonical,
  validateCurationProfile,
  validateManifest,
} from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../../..');
const manifestsDir = join(repoRoot, 'fixtures/manifests');
const curationDir = join(repoRoot, 'fixtures/curation');

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

const manifestFixtures = readdirSync(manifestsDir)
  .filter((name) => name.endsWith('.manifest.json'))
  .map((name) => ({
    name,
    path: join(manifestsDir, name),
  }));

describe('contract: manifest fixtures', () => {
  it.each(manifestFixtures)('validates $name', ({ path }) => {
    const manifest = loadJson(path);
    const result = validateManifest(manifest);
    expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
  });

  it.each(manifestFixtures)('round-trips $name deterministically', ({ path }) => {
    const manifest = loadJson(path);
    expect(roundTripDeterministic(manifest)).toBe(true);
  });

  it.each(manifestFixtures)('canonical serialize is stable for $name', ({ path }) => {
    const manifest = loadJson(path);
    const first = serializeCanonical(manifest);
    const second = serializeCanonical(JSON.parse(first));
    expect(first).toBe(second);
  });
});

describe('contract: curation profile fixtures', () => {
  it('validates petstore curation profile', () => {
    const profile = loadJson(join(curationDir, 'petstore.curation.json'));
    const result = validateCurationProfile(profile);
    expect(result.valid, JSON.stringify(result.errors, null, 2)).toBe(true);
  });
});

describe('contract: invalid manifest variants', () => {
  it('rejects manifest with forbidden secret field', () => {
    const base = loadJson(join(manifestsDir, 'petstore-apikey.manifest.json')) as Record<
      string,
      unknown
    >;
    const invalid = {
      ...base,
      auth: {
        ...(base.auth as Record<string, unknown>),
        clientSecret: 'super-secret',
      },
    };

    const result = validateManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.code === 'forbiddenSecretField')).toBe(true);
  });

  it('rejects manifest with auth type / apply mismatch', () => {
    const base = loadJson(join(manifestsDir, 'petstore-apikey.manifest.json')) as Record<
      string,
      unknown
    >;
    const invalid = {
      ...base,
      auth: {
        bindingId: 'cb_bad',
        type: 'oauth2_cc',
        apply: { in: 'header', name: 'X-API-Key' },
      },
    };

    const result = validateManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.code === 'authApplyMismatch')).toBe(true);
  });

  it('rejects manifest missing egress allowlist host', () => {
    const base = loadJson(join(manifestsDir, 'petstore-apikey.manifest.json')) as Record<
      string,
      unknown
    >;
    const invalid = {
      ...base,
      policies: {
        ...(base.policies as Record<string, unknown>),
        egressAllowlist: ['other.example.com'],
      },
    };

    const result = validateManifest(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors?.some((e) => e.code === 'egressAllowlist')).toBe(true);
  });
});
