import { describe, expect, it, vi } from 'vitest';

import type { DiscoveryIndexRow } from '@mcp-definer/db';

import {
  buildIndexFromDiscoveryView,
  discoveryRowsToEntries,
  isDiscoveryIndexReader,
} from './discovery-index.js';
import type { DiscoveryIndexReader, RegistryContext } from './types.js';

function sampleRow(overrides: Partial<DiscoveryIndexRow> = {}): DiscoveryIndexRow {
  return {
    org_slug: 'acme',
    mcp_id: 'mcp-1',
    mcp_slug: 'petstore',
    name: 'Petstore',
    description: 'Demo API',
    visibility: 'public',
    version_id: 'ver-1',
    latest_version: '1.0.0',
    channel: 'stable',
    mcp_protocol_version: '2024-11-05',
    manifest_schema_version: '1.0',
    published_at: new Date('2024-01-01'),
    deprecated_at: null,
    tool_count: 2,
    tool_names: ['getPetById', 'findPetsByStatus'],
    tags: ['demo'],
    ...overrides,
  };
}

describe('isDiscoveryIndexReader', () => {
  it('returns true when store implements listDiscoveryIndexEntries', () => {
    const store = { listDiscoveryIndexEntries: vi.fn() };
    expect(isDiscoveryIndexReader(store as RegistryContext['store'])).toBe(true);
  });

  it('returns false for in-memory store without discovery reader', () => {
    expect(isDiscoveryIndexReader({} as RegistryContext['store'])).toBe(false);
  });
});

describe('discoveryRowsToEntries', () => {
  it('maps rows to discovery entries with install and manifest URLs', () => {
    const [entry] = discoveryRowsToEntries([sampleRow()], 'https://api.example.com/v1');

    expect(entry.org).toBe('acme');
    expect(entry.slug).toBe('petstore');
    expect(entry.toolNames).toEqual(['findPetsByStatus', 'getPetById']);
    expect(entry.installUrl).toBe(
      'https://api.example.com/v1/registry/acme/petstore/install?harness=cursor',
    );
    expect(entry.manifestUrl).toBe(
      'https://api.example.com/v1/registry/acme/petstore/versions/1.0.0/manifest',
    );
  });

  it('normalizes draft channel to stable in entries', () => {
    const [entry] = discoveryRowsToEntries(
      [sampleRow({ channel: 'draft' })],
      'https://api.example.com/v1',
    );
    expect(entry.channel).toBe('stable');
  });
});

describe('buildIndexFromDiscoveryView', () => {
  it('delegates to reader and caps limit at 100', async () => {
    const reader: DiscoveryIndexReader = {
      listDiscoveryIndexEntries: vi.fn(async () => ({
        entries: discoveryRowsToEntries([sampleRow()], '/v1'),
        nextCursor: undefined,
      })),
    };

    const ctx: RegistryContext = { store: {} as RegistryContext['store'], baseUrl: '/v1' };
    const index = await buildIndexFromDiscoveryView(ctx, reader, {
      limit: 500,
      generatedAt: '2024-06-01T00:00:00.000Z',
    });

    expect(index.indexVersion).toBe('1.0');
    expect(index.generatedAt).toBe('2024-06-01T00:00:00.000Z');
    expect(index.entries).toHaveLength(1);
    expect(reader.listDiscoveryIndexEntries).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100, baseUrl: '/v1' }),
    );
  });
});
