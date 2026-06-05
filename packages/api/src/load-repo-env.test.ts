import { existsSync } from 'node:fs';
import { config } from 'dotenv';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { loadRepoEnv } from './load-repo-env.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

describe('loadRepoEnv', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReset();
    vi.mocked(config).mockReset();
  });

  it('loads repo-root .env when the file exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);

    loadRepoEnv();

    expect(existsSync).toHaveBeenCalled();
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({ path: expect.stringMatching(/\.env$/) }),
    );
  });

  it('skips dotenv when .env is missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    loadRepoEnv();

    expect(config).not.toHaveBeenCalled();
  });
});
