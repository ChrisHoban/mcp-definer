# Platform Bootstrap — Requirements

## Functional

- PB-01 Create monorepo layout per `PROJECT_STRUCTURE.md`.
- PB-02 Configure pnpm workspaces spanning `packages/*` and `apps/*`.
- PB-03 Shared TypeScript, ESLint, Prettier, Vitest configuration at root.
- PB-04 Docker Compose for Postgres local development.
- PB-05 Empty package stubs with correct inter-package dependency declarations.
- PB-06 Root npm scripts: bootstrap, db:migrate, test, lint, build, contract-test.
- PB-07 CI workflow running lint + test + contract-test on PRs.
- PB-08 `.env.example` with documented variables.
- PB-09 `fixtures/` directory structure (manifests, openapi, golden, registry).

## Non-Functional

- PB-N1 Any agent cloning the repo can run `pnpm bootstrap` and get a working dev DB.
- PB-N2 No business logic in A0 — stubs only.
- PB-N3 Package names and paths are stable; downstream agents must not rename them without ADR.

## Acceptance criteria

- Fresh clone → `pnpm bootstrap` → exits 0.
- `pnpm lint && pnpm test` pass with zero implementation.
- All packages listed in `PROJECT_STRUCTURE.md` exist with correct dependency edges.
