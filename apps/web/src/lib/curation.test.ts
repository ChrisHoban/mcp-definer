import { describe, expect, it } from 'vitest';

import {
  assessDescriptionQuality,
  bulkSetExcluded,
  createEmptyCuration,
  isOperationIncluded,
  toggleOperationExcluded,
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
});
