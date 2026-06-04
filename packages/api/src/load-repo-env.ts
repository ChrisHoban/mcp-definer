import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

/** Load repo-root `.env` without overriding variables already set in the process. */
export function loadRepoEnv(): void {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  const envPath = resolve(repoRoot, '.env');
  if (existsSync(envPath)) {
    config({ path: envPath });
  }
}
