# Testing Strategy

Cross-cutting test expectations for multi-agent development. Each component adds unit tests; this doc defines **contract tests** and **E2E** that prevent integration failures.

## Test layers

| Layer       | Owner                | When                                 | Location                                |
| ----------- | -------------------- | ------------------------------------ | --------------------------------------- |
| Unit        | Each component agent | Per package                          | `packages/*/src/**/*.test.ts`           |
| Web UI      | A8 + A9              | CSS compile, route smoke, components | `apps/web/src/**/*.test.{ts,tsx}`       |
| Contract    | A1 + A9              | Schema/API shape stability           | `fixtures/`, `scripts/contract-test.sh` |
| Integration | A9 (mandatory)       | Real services wired                  | `packages/api/tests/integration/`       |
| E2E         | A9                   | Full user loop                       | `tests/e2e/`                            |

## Contract tests (run in CI from Phase 1)

### Schema contracts (A1)

- IR + Manifest + CurationProfile JSON Schemas validate all fixtures in `fixtures/manifests/`.
- `validateManifest()` returns `{ valid: true }` for valid fixtures; errors for intentionally invalid variants.
- Determinism: canonical serialize → parse → serialize yields identical bytes.

### Generator golden files (A2)

- Given `fixtures/openapi/petstore.yaml` + empty curation → output matches `fixtures/golden/petstore.manifest.json`.
- Same input run twice → byte-identical output (NFR-06).

### Request pipeline (A3 + A6)

- Egress allow-list blocks requests to non-allowed hosts (runtime **and** `:invoke`).
- Secrets redacted from logs in test capture.

### Discovery index (A5 + A6)

- API `GET /v1/index` response validates against `fixtures/registry/index-v1.json` shape.

### Credential resolver (A4)

- Write secret → resolve returns value in memory → API GET binding never returns value.

## Integration tests (A9)

Minimum scenarios:

1. **Parse pipeline:** upload spec → IR returned with expected operation count.
2. **Publish pipeline:** draft → validate → publish → immutable (409 on PATCH).
3. **Install snippet:** published MCP → Cursor config snippet contains runtime + manifest URL.
4. **Runtime smoke:** load fixture manifest → `tools/list` returns expected tools.
5. **Invoke parity:** same tool call via runtime and `:invoke` produces equivalent outbound request (mock HTTP server).

## E2E acceptance (A9 — definition of done)

```
import fixtures/openapi/petstore.yaml (via CLI or API)
  → generate manifest + save draft
  → configure apiKey binding (env)
  → validate → publish
  → discovery index lists petstore
  → CLI install writes Cursor mcp.json
  → runtime serves manifest over stdio
  → tools/call reaches mock upstream API
```

## Mock strategy for parallel agents

| Consumer    | Mock until real                                           |
| ----------- | --------------------------------------------------------- |
| A7/A8 UI    | A6 OpenAPI mock server + fixture responses                |
| A6 API      | Stub generator/registry/runtime/auth modules              |
| A3 runtime  | A4 in-memory credential resolver stub                     |
| A5 registry | A1 validator from `@mcp-definer/schemas` (real, not stub) |

## CI commands

```bash
pnpm install
pnpm build
pnpm test              # all unit tests
pnpm contract-test     # schema + golden + pipeline + API shape + determinism
pnpm test:integration  # API integration (in-memory registry; Postgres service optional)
pnpm test:e2e          # full Petstore loop (API + CLI + runtime + mock upstream)
pnpm test:web          # web unit + route smoke + CSS module compile (jsdom)
pnpm test:web:build    # production Vite build (catches CSS/PostCSS errors)
```

### Web UI tests (`apps/web`)

Run from repo root (uses the web package Vitest config with jsdom + Vite CSS pipeline):

```bash
pnpm test:web
pnpm test:web:build   # same check as CI; fails on invalid CSS like management.module.css
```

| Test          | File                             | What it catches                               |
| ------------- | -------------------------------- | --------------------------------------------- |
| CSS modules   | `src/test/css-modules.test.ts`   | Invalid PostCSS/CSS syntax in `*.module.css`  |
| Route smoke   | `src/test/routes.smoke.test.tsx` | Main routes render without throw (mocked API) |
| Feature tests | `src/features/**/*.test.tsx`     | RBAC, wizard steps, forms                     |

Fast subset:

```bash
pnpm --filter @mcp-definer/web test:smoke
```

### Environment variables

| Variable              | Default                    | Used by                                                             |
| --------------------- | -------------------------- | ------------------------------------------------------------------- |
| `MOCK_MODE`           | `true` (unless `false`)    | API: seed petstore fixture when `true`; empty registry when `false` |
| `MCP_DEFINER_API_KEY` | `dev-api-key`              | Control-plane `X-API-Key` auth                                      |
| `API_PUBLIC_URL`      | `http://localhost:3001/v1` | Discovery install/manifest URLs in snippets                         |
| `DATABASE_URL`        | (from docker-compose)      | `pnpm db:migrate` / future Postgres-backed stores                   |

Integration tests default to **in-memory** registry for speed. `packages/api/tests/integration/postgres-pipeline.test.ts` exercises **Postgres registry + env credential bindings** when `DATABASE_URL` is available (`SKIP_DB_TESTS=true` to skip).

E2E (`tests/e2e/`) uses **Postgres** (`REGISTRY_STORE=postgres`) and requires a running database (CI provides Postgres; local: `docker compose -f docker/docker-compose.yml up -d` then `pnpm db:migrate`).

### Local verification (A9)

```bash
pnpm install
pnpm build
pnpm test
pnpm contract-test
pnpm test:integration
pnpm test:e2e
```

Optional manual stack:

```bash
pnpm dev:api    # MOCK_MODE=true, petstore seeded on :3001
pnpm dev:web    # wizard + management UI
```

A0 creates placeholder scripts; A1 adds first real contract tests; A9 completes the suite.
