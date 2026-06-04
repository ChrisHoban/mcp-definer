# @mcp-definer/db

PostgreSQL DDL, migrations, and discovery view SQL.

## Local Postgres (Docker)

From the repo root:

```bash
docker compose -f docker/docker-compose.yml up -d
```

Default credentials (match `docker/docker-compose.yml` and `.env.example`):

| Setting  | Value         |
| -------- | ------------- |
| Host     | `localhost`   |
| Port     | `5432`        |
| User     | `mcp_definer` |
| Password | `mcp_definer` |
| Database | `mcp_definer` |

Connection URL:

```text
postgresql://mcp_definer:mcp_definer@localhost:5432/mcp_definer
```

## Configure credentials locally

1. Copy the example env file at the **repo root** (not inside this package):

   ```bash
   copy .env.example .env
   ```

2. Edit `.env` if your Postgres differs (different port, user, or a non-Docker instance).

3. Run migrations from the repo root:

   ```bash
   pnpm build
   pnpm db:migrate
   ```

   Or one-shot bootstrap (install + Docker + migrate):

   ```bash
   pnpm bootstrap
   ```

`pnpm db:migrate` loads `.env` automatically. Without a `.env` file, migrations use the built-in default URL above (same as Docker).

## Troubleshooting

| Symptom | Likely cause | Fix |
| ------- | ------------ | --- |
| `ECONNREFUSED` on `localhost:5432` | Postgres not running | `docker compose -f docker/docker-compose.yml up -d` and wait for healthy container |
| `password authentication failed` | Wrong user/password or another Postgres on 5432 | Set `DATABASE_URL` in `.env` to match your instance, or stop the conflicting service |
| `Cannot find module '../dist/migrate.js'` | Package not built | `pnpm build` then `pnpm db:migrate` |
| Tests skipped (`db: migrations…`) | Same connection issues | Fix Postgres + `.env`, then `pnpm test` |

Check the container:

```bash
docker ps --filter name=mcp-definer-postgres
docker logs mcp-definer-postgres
```

Test connectivity (with [psql](https://www.postgresql.org/download/) or any client):

```bash
psql "postgresql://mcp_definer:mcp_definer@localhost:5432/mcp_definer" -c "SELECT 1"
```
