import { describe, expect, it, vi, afterEach } from 'vitest';

import { createLogger } from './logger.js';

describe('createLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes JSON logs to stderr', () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createLogger();
    logger.info('tool invoked', { tool: 'getPetById' });

    expect(stderr).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(stderr.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: 'INFO',
      message: 'tool invoked',
      tool: 'getPetById',
    });
  });

  it('redacts credential values from log messages', () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createLogger({
      bindingId: 'cb_test',
      authType: 'apiKey',
      value: 'super-secret-key',
      apply: { in: 'header', name: 'X-API-Key' },
    });

    logger.error('request failed: super-secret-key in url');

    const payload = JSON.parse(String(stderr.mock.calls[0][0]));
    expect(payload.message).not.toContain('super-secret-key');
    expect(payload.message).toContain('[REDACTED]');
  });
});
