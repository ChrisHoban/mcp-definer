import { describe, expect, it } from 'vitest';

import {
  assessDescriptionQuality,
  bulkSetExcluded,
  buildManifestFromIr,
  createEmptyCuration,
  ensureCurationVersion,
  getEffectiveDescription,
  getEffectiveToolName,
  isOperationIncluded,
  toggleOperationExcluded,
  updateInputSchemaOverride,
  updateToolDescription,
  updateToolGroup,
  updateToolRename,
} from './curation';

describe('curation helpers', () => {
  it('toggles operation exclusion', () => {
    let c = createEmptyCuration();
    expect(isOperationIncluded('getPet', c)).toBe(true);

    c = toggleOperationExcluded(c, 'getPet', true);
    expect(isOperationIncluded('getPet', c)).toBe(false);

    c = bulkSetExcluded(c, ['a', 'b'], true);
    expect(c.excludedOperationIds).toEqual(expect.arrayContaining(['getPet', 'a', 'b']));
  });

  it('assesses description quality', () => {
    expect(assessDescriptionQuality('').level).toBe('bad');
    expect(assessDescriptionQuality('short desc').level).toBe('warn');
    expect(
      assessDescriptionQuality(
        'Fetch a pet by its unique identifier including name, status, and category for agent workflows.',
      ).level,
    ).toBe('good');
  });

  it('updates tool metadata and effective names', () => {
    let c = createEmptyCuration();
    c = updateToolDescription(c, 'getPet', 'Fetch a pet');
    c = updateToolRename(c, 'getPet', 'fetchPet');
    c = updateToolGroup(c, 'getPet', 'pets');
    c = updateInputSchemaOverride(c, 'getPet', { type: 'object', properties: {} });
    c = ensureCurationVersion(c);

    expect(getEffectiveToolName('getPet', c)).toBe('fetchPet');
    expect(getEffectiveDescription('getPet', c)).toBe('Fetch a pet');
    expect(c.toolGroups?.getPet).toBe('pets');
    expect(c.curationVersion).toBe('1.0');
  });

  it('buildManifestFromIr applies curation exclusions', () => {
    const ir = {
      irVersion: '1.0' as const,
      source: {
        type: 'swagger2' as const,
        hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      },
      servers: [{ url: 'https://example.com' }],
      operations: [
        {
          id: 'getPet',
          method: 'GET' as const,
          path: '/pet',
          parameters: [],
          responses: [{ status: '200' }],
        },
        {
          id: 'deletePet',
          method: 'DELETE' as const,
          path: '/pet/{id}',
          parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }],
          responses: [{ status: '200' }],
        },
      ],
      securitySchemes: {},
    };

    const curation = bulkSetExcluded(createEmptyCuration(), ['deletePet'], true);
    const manifest = buildManifestFromIr(ir, curation, {
      slug: 'pets',
      name: 'Pets API',
      description: 'Pet operations',
    });

    expect(manifest.tools.some((t) => t.name === 'getPet')).toBe(true);
    expect(manifest.tools.some((t) => t.name === 'deletePet')).toBe(false);
  });
});
