import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertCurationProfile, validateCurationProfile } from './curation-profile.js';
import { assertIr, validateIr } from './ir.js';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../../..');

const minimalValidIr = {
  irVersion: '1.0' as const,
  source: {
    type: 'openapi3' as const,
    hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
  },
  servers: [{ url: 'https://example.com' }],
  operations: [],
  securitySchemes: {},
};

describe('validateIr', () => {
  it('accepts a minimal valid IR', () => {
    const result = validateIr(minimalValidIr);
    expect(result.valid).toBe(true);
  });

  it('rejects IR missing required fields', () => {
    const result = validateIr({ irVersion: '1.0' });
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('assertIr returns typed IR when valid', () => {
    expect(assertIr(minimalValidIr).irVersion).toBe('1.0');
  });

  it('assertIr throws with path details when invalid', () => {
    expect(() => assertIr({})).toThrow(/required|irVersion/i);
  });
});

describe('validateCurationProfile', () => {
  it('rejects profile missing required fields', () => {
    const result = validateCurationProfile({ version: '1.0' });
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('assertCurationProfile throws when invalid', () => {
    expect(() => assertCurationProfile({})).toThrow(/Invalid curation profile|required/i);
  });

  it('assertCurationProfile returns profile for fixture', () => {
    const profile = JSON.parse(
      readFileSync(join(repoRoot, 'fixtures/curation/petstore.curation.json'), 'utf8'),
    );
    expect(assertCurationProfile(profile).curationVersion).toBe('1.0');
  });
});
