#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing dependencies..."
pnpm install

echo "==> Starting Postgres (docker compose)..."
docker compose -f docker/docker-compose.yml up -d

echo "==> Running database migrations..."
node packages/db/scripts/migrate.mjs

echo "==> Bootstrap complete."
