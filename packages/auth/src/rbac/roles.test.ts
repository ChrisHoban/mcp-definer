import { describe, expect, it } from 'vitest';

import { highestRole, roleAtLeast } from './roles.js';

describe('roleAtLeast', () => {
  it('ranks owner above admin and viewer', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('viewer', 'admin')).toBe(false);
    expect(roleAtLeast('author', 'author')).toBe(true);
  });
});

describe('highestRole', () => {
  it('returns null for empty list', () => {
    expect(highestRole([])).toBeNull();
  });

  it('picks the highest role from memberships', () => {
    expect(highestRole(['viewer', 'admin', 'author'])).toBe('admin');
    expect(highestRole(['viewer', 'owner'])).toBe('owner');
  });
});
