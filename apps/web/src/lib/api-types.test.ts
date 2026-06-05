import { describe, expect, it } from 'vitest';

import { ApiError } from './api-types';

describe('ApiError', () => {
  it('stores status and problem payload', () => {
    const err = new ApiError('Invalid', 422, { code: 'VALIDATION', detail: 'Invalid' });
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Invalid');
    expect(err.status).toBe(422);
    expect(err.problem?.code).toBe('VALIDATION');
  });
});
