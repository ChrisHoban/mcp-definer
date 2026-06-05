# Platform Bootstrap — Tasks

## 1. Repository skeleton

- [ ] Create directory tree per `PROJECT_STRUCTURE.md`.
- [ ] Initialize root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`.
- [ ] Add `.gitignore`, `.env.example`, `README.md` implementation section.

## 2. Tooling

- [ ] ESLint + Prettier (shared config).
- [ ] Vitest (root + per-package).
- [ ] Optional Turborepo `turbo.json`.

## 3. Package stubs

- [ ] Create all packages under `packages/` and `apps/web` with minimal `package.json`, `src/index.ts`, `tsconfig.json`.
- [ ] Wire workspace dependencies per dependency graph.

## 4. Docker & DB hook

- [ ] `docker/docker-compose.yml` (Postgres).
- [ ] `packages/db` stub with empty `migrate` script (A1 fills in).

## 5. CI & scripts

- [ ] `.github/workflows/ci.yml`.
- [ ] Root scripts: bootstrap, db:migrate, test, lint, build, contract-test.
- [ ] `scripts/contract-test.sh` placeholder.

## 6. Fixtures

- [ ] Create empty `fixtures/{manifests,openapi,golden,registry}/.gitkeep`.

## Definition of done

- `pnpm bootstrap && pnpm lint && pnpm test` succeed on empty implementation.
- A1 can begin work in `packages/schemas` and `packages/db` immediately.
