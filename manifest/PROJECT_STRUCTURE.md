# Project Structure (Monorepo)

This document defines the **canonical repository layout**. Agent **A0 (platform bootstrap)** creates this skeleton; all other agents implement packages within it. Do not invent alternate layouts.

## Top-level layout

```
mcp-definer/
├── manifest/                      # Design/spec docs (requirements, ADRs, component specs)
├── packages/
│   ├── schemas/                   # A1 — IR + Manifest JSON Schema, generated TS types, validator
│   ├── db/                        # A1 — DDL, migrations, discovery view SQL
│   ├── generator/                 # A2 — spec → IR → Manifest
│   ├── runtime/                   # A3 — Universal MCP server
│   ├── auth/                      # A4 — AuthN/AuthZ + credential resolver
│   ├── registry/                  # A5 — domain logic (NOT HTTP); publish, catalog, install snippets
│   ├── api/                       # A6 — HTTP server; orchestrates generator/runtime/registry/auth
│   ├── cli/                       # A5/RG2 — `mcp-definer` CLI (install, publish helpers)
│   └── request-pipeline/          # Shared HTTP execution (runtime + :invoke); SSRF, retries, shaping
├── apps/
│   └── web/                       # A7/A8 — React UI
├── fixtures/                      # Shared test fixtures (Manifests, OpenAPI specs, golden files)
├── docker/
│   ├── docker-compose.yml         # Postgres, MinIO (optional), dev services
│   └── Dockerfile.api             # Control-plane API (later)
├── scripts/
│   ├── bootstrap.sh               # First-time dev setup
│   └── contract-test.sh           # Cross-package contract tests
├── .github/workflows/             # CI: lint, test, contract tests
├── package.json                   # npm/pnpm workspaces root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json                     # (optional) Turborepo task graph
└── README.md
```

## Package dependency graph (implementation)

```
packages/schemas          ← foundation (A1)
packages/db               ← depends on schemas (types only)
packages/request-pipeline ← depends on schemas
packages/generator        ← depends on schemas
packages/auth             ← depends on schemas, db
packages/runtime          ← depends on schemas, auth (resolver), request-pipeline
packages/registry         ← depends on schemas, db, generator (calls validator from schemas)
packages/api              ← depends on generator, runtime, registry, auth, db
packages/cli              ← depends on registry, api client types
apps/web                  ← depends on api (OpenAPI client / mock)
```

## Key boundaries

| Package                     | Owns HTTP? | Notes                                                           |
| --------------------------- | ---------- | --------------------------------------------------------------- |
| `packages/registry`         | **No**     | Domain/service layer only. Called by `packages/api`.            |
| `packages/api`              | **Yes**    | Sole HTTP entry point for control plane + discovery.            |
| `packages/runtime`          | MCP only   | stdio/HTTP MCP transport — not REST.                            |
| `packages/request-pipeline` | No         | Shared lib used by `runtime` and `api` (`:invoke`).             |
| `packages/cli`              | No         | Writes local harness config; calls API or reads registry index. |

## Workspace tooling (A0 delivers)

- **Package manager:** pnpm workspaces
- **Language:** TypeScript (ADR-002)
- **Build:** `tsc` per package; optional Turborepo for orchestration
- **Test:** Vitest
- **Lint/format:** ESLint + Prettier (shared config at root)
- **DB migrations:** Drizzle ORM or node-pg-migrate in `packages/db`
- **CI:** GitHub Actions — `lint`, `test`, `contract-test` on every PR

## Local development (A0 delivers)

```bash
pnpm install
docker compose -f docker/docker-compose.yml up -d   # Postgres
pnpm db:migrate
pnpm dev:api      # control plane (when A6 exists)
pnpm dev:web      # UI (when A7 exists)
```

## Fixture conventions

- `fixtures/manifests/` — example Manifests (apiKey, bearer, oauth2_cc)
- `fixtures/openapi/` — Petstore, large-api, messy-spec
- `fixtures/golden/` — expected Manifest output per fixture spec (determinism tests)
- `fixtures/registry/` — discovery index response examples

All agents add fixtures here; do not duplicate inside package folders unless package-local unit tests require it.
