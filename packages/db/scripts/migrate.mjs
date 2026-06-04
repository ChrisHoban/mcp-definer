import '../../../scripts/load-env.mjs';
import { resolveDatabaseUrl } from '../dist/env.js';
import { runMigrations } from '../dist/migrate.js';

const databaseUrl = resolveDatabaseUrl(process.env);
console.log(`Connecting to ${databaseUrl.replace(/:([^:@/]+)@/, ':***@')}`);

runMigrations(databaseUrl).catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
