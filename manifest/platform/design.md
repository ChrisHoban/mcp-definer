# Platform Bootstrap — Design

## Goal

Deliver a **runnable empty monorepo** in one agent context. Downstream agents drop implementation into pre-created packages without debating structure.

## Monorepo initialization

1. Create layout per [`PROJECT_STRUCTURE.md`](../PROJECT_STRUCTURE.md).
2. Root `package.json` with workspaces: `packages/*`, `apps/*`.
3. Shared `tsconfig.base.json` with path aliases:
   - `@mcp-definer/schemas` → `packages/schemas`
   - `@mcp-definer/db` → `packages/db`
   - etc.

## Package stubs

Each package gets:
- `package.json` (name, version, main/types exports, workspace deps)
- `src/index.ts` (empty export or `export {}`)
- `tsconfig.json` (extends root)
- `vitest.config.ts` (optional, can share root)

**Dependency edges** must match the graph in `PROJECT_STRUCTURE.md` even if packages are empty.

## Docker Compose (`docker/docker-compose.yml`)

Services for local dev:
- **postgres:16** — port 5432, database `mcp_definer`, user/pass in `.env.example`
- **minio** (optional, commented) — for object storage in later phases

No application containers in A0; apps run via `pnpm dev:*`.

## Environment

`.env.example`:
```
DATABASE_URL=postgresql://mcp_definer:mcp_definer@localhost:5432/mcp_definer
API_PORT=3000
WEB_PORT=5173
NODE_ENV=development
```

## CI (`.github/workflows/ci.yml`)

Jobs:
1. **lint** — ESLint + Prettier check
2. **test** — `pnpm test` (passes with zero tests initially)
3. **contract-test** — `pnpm contract-test` (placeholder script; A1/A9 flesh out)

## Scripts (root `package.json`)

| Script | Purpose |
|---|---|
| `bootstrap` | `pnpm install && docker compose up -d && pnpm db:migrate` |
| `db:migrate` | Run migrations from `packages/db` |
| `test` | Vitest across workspaces |
| `lint` | ESLint all packages |
| `contract-test` | Cross-package contract tests |
| `build` | Build all packages |

## Contract-test placeholder

`scripts/contract-test.sh` initially exits 0 with a message. A1 adds schema round-trip tests; A9 adds E2E. This gives CI a hook from day one.

## Hand-off to A1

A0 completes when:
- `pnpm install && pnpm lint && pnpm test` succeed
- Docker Postgres starts
- `packages/schemas` and `packages/db` exist as empty stubs ready for A1
