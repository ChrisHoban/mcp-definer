import { runMigrations } from '../packages/db/src/migrate.js';

export default async function setup(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return;
  }

  await runMigrations(databaseUrl);
}
