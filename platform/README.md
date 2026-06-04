# Platform Bootstrap (Agent A0)

**Runs first.** Creates the monorepo skeleton, dev environment, CI, and shared tooling so every downstream agent implements code in a consistent structure.

## Responsibilities

- Initialize the monorepo per [`PROJECT_STRUCTURE.md`](../PROJECT_STRUCTURE.md)
- Configure pnpm workspaces, TypeScript, ESLint, Prettier, Vitest
- Docker Compose for Postgres (+ optional MinIO)
- CI skeleton (lint + test + contract-test placeholder)
- Empty package stubs with correct `package.json` dependencies and export paths
- Root scripts: `bootstrap`, `db:migrate`, `test`, `lint`
- `fixtures/` directory structure

## Dependencies

- **Consumes:** [`PROJECT_STRUCTURE.md`](../PROJECT_STRUCTURE.md), [`ARCHITECTURE_DECISIONS.md`](../ARCHITECTURE_DECISIONS.md)
- **Consumed by:** every other agent (A1–A9)

## Does NOT build

- Business logic, schemas, API endpoints, UI, MCP server, or database tables (that's A1+)

## Files

- [`design.md`](./design.md)
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)
