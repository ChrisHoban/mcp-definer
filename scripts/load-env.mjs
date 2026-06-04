/**
 * Loads repo-root `.env` into process.env (does not override existing env vars).
 * Used by db migrations and Vitest so local DATABASE_URL is picked up automatically.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = resolve(repoRoot, '.env');

if (existsSync(envPath)) {
  const result = config({ path: envPath });
  if (result.error) {
    console.warn(`Warning: could not load ${envPath}:`, result.error.message);
  }
} else {
  console.warn(
    `No .env at ${envPath} — using process.env and built-in defaults. Copy .env.example to .env for local credentials.`,
  );
}
