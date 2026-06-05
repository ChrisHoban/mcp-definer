# Agent Kickoff Briefs

Copy the brief for your assigned agent into a new context. Each brief is self-contained: what to read, what to build, what to freeze for others, and how you know you're done.

> **Global rules (every agent):** Honor [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md). Implement in the monorepo layout defined by [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md). Never put secrets in Manifests, API responses, or logs (ADR-004). Use stable requirement IDs from [`REQUIREMENTS.md`](./REQUIREMENTS.md). Do not change a contract you don't own without an ADR.

---

## A0 — platform bootstrap

**Role:** Create the empty monorepo so every other agent implements code in a consistent structure.

### Read first

1. [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md)
2. [`platform/README.md`](./platform/README.md)
3. [`platform/design.md`](./platform/design.md)
4. [`platform/tasks.md`](./platform/tasks.md)

### Your scope

- Monorepo skeleton (`packages/*`, `apps/web`, `fixtures/`, `docker/`)
- pnpm workspaces, TypeScript, ESLint, Prettier, Vitest
- Docker Compose (Postgres)
- CI workflow (lint, test, contract-test placeholder)
- Empty package stubs with correct dependency edges
- Root scripts: `bootstrap`, `db:migrate`, `test`, `lint`, `build`

### Must freeze early (unblocks everyone)

- Runnable `pnpm bootstrap && pnpm lint && pnpm test`
- All package paths from `PROJECT_STRUCTURE.md` exist

### Do NOT build

- Schemas, business logic, API, UI, MCP server, DB tables

### Done when

- Fresh clone → `pnpm bootstrap` succeeds
- A1 can start in `packages/schemas` and `packages/db` immediately

---

## A1 — data-structure

**Role:** Foundation. You own the central contracts everyone else waits on.

### Read first (in order)

1. [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md)
2. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — especially ADR-001, ADR-004, ADR-006, ADR-009
3. [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — implement in `packages/schemas` and `packages/db`
4. [`data-structure/design.md`](./data-structure/design.md)
5. [`data-structure/requirements.md`](./data-structure/requirements.md)
6. [`data-structure/tasks.md`](./data-structure/tasks.md)

### Your scope (in `packages/schemas` + `packages/db`)

- IR + Manifest + **CurationProfile** schemas (JSON Schema + shared TS types)
- **`validateManifest()` — you own this**; generator/registry/api call it from `@mcp-definer/schemas`
- Relational model: **org_memberships**, **source_specs**, **curation_profiles**, plus all other tables
- Discovery read view, migrations, immutability enforcement
- Example fixtures in `fixtures/manifests/` (apiKey, bearer, oauth2_cc)

### Must freeze early (unblocks A2, A3, A4, A5, A6)

Publish `@mcp-definer/schemas` as soon as ready — do not wait for DB hardening:

- JSON Schemas for IR + Manifest + CurationProfile
- Generated TS types + **`validateManifest()` implementation**
- 3 example Manifest fixtures + deterministic serialization rules
- Contract tests in `pnpm contract-test` (schema validation + determinism)

### Do NOT build

- HTTP endpoints, UI, spec parsing, MCP server, vault integration

### Done when

- Schemas validate fixtures; round-trip determinism test passes
- DDL + migrations apply; published-version immutability enforced
- Discovery view queryable
- Downstream agents can import types + validator without talking to you

---

## A2 — generator

**Role:** Spec → IR → Manifest. You absorb all spec-format complexity.

### Read first

1. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — ADR-003, ADR-004
2. [`data-structure/design.md`](./data-structure/design.md) — IR + Manifest sections (your output contract)
3. [`generator/README.md`](./generator/README.md)
4. [`generator/design.md`](./generator/design.md)
5. [`generator/requirements.md`](./generator/requirements.md)
6. [`generator/tasks.md`](./generator/tasks.md)

### Prerequisites

- **A0 complete:** monorepo exists
- **A1 frozen:** IR + Manifest + CurationProfile schemas, `@mcp-definer/schemas` validator, fixtures

### Your scope (in `packages/generator`)

- Spec ingestion → IR; persist via API layer later (`source_specs` table)
- Mapping engine; read/write **curation_profiles** when invoked by API
- MVP OpenAPI subset only — see generator design exclusions
- Call `validateManifest()` from `@mcp-definer/schemas` — **do not implement your own validator**
- Regeneration + diff (uses stored curation + source_specs)

### Must freeze early (unblocks A5, A6)

- Petstore fixture → deterministic Manifest matching `fixtures/golden/petstore.manifest.json`

### Do NOT build

- HTTP server, UI, MCP runtime, database persistence, secrets storage

### Done when

- Simple + large + messy OpenAPI fixtures → valid, deterministic Manifests
- Regeneration diff works; validation returns actionable errors
- Same input + curation → byte-identical output

### Sub-agent split (if too large)

- **G1:** ingestion + IR only → freeze IR output
- **G2:** mapping + curation + validation + Manifest emission
- **G3:** regeneration + diff (optional; can fold into G2)

---

## A3 — runtime

**Role:** Universal MCP server. Load any Manifest, serve it, call the target API.

### Read first

1. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — ADR-001, ADR-004, ADR-008, ADR-012
2. [`data-structure/design.md`](./data-structure/design.md) — Manifest schema
3. [`authentication/design.md`](./authentication/design.md) — credential resolver section
4. [`runtime/README.md`](./runtime/README.md)
5. [`runtime/design.md`](./runtime/design.md)
6. [`runtime/requirements.md`](./runtime/requirements.md)
7. [`runtime/tasks.md`](./runtime/tasks.md)

### Prerequisites

- **A1 frozen:** Manifest schema + fixtures
- **A4 stub (or real):** credential resolver interface

### Your scope (in `packages/runtime` + `packages/request-pipeline`)

- **`packages/request-pipeline`** (ADR-012): outbound HTTP, egress allow-list, retries, response shaping — **shared with A6 `:invoke`**
- MCP server via `@modelcontextprotocol/sdk` in `packages/runtime`
- Manifest load by path or URL (ADR-008); validate via `@mcp-definer/schemas`
- stdio transport for Phase 1; defer Streamable HTTP to Phase 4
- CLI: `npx @mcp-definer/runtime --manifest <path|url>`

### Must freeze early (unblocks A6 `:invoke` + A9)

- `executeToolCall(manifest, tool, args, credential)` exported from `request-pipeline`
- Runtime stdio entrypoint working with A1 fixtures + A4 resolver stub

### Do NOT build

- Control plane API, UI, spec parsing, registry publish logic, user login

### Done when

- Loads an A1 fixture Manifest; serves in Cursor over stdio
- Invalid args rejected without outbound call
- Egress allow-list blocks off-host requests
- No secret appears in logs/traces

### Sub-agent split

- **R1:** core server + tool pipeline (MCP SDK, manifest load, arg validation, HTTP build, response shaping, credential apply)
- **R2:** transports + policies + observability (stdio/HTTP, retries, SSRF, logging/tracing)

---

## A4 — authentication

**Role:** Platform auth (who can use the system) + target-API credentials (how MCPs call upstream APIs).

### Read first

1. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — ADR-004, ADR-005
2. [`data-structure/design.md`](./data-structure/design.md) — **org_memberships**, credential_bindings
3. [`authentication/README.md`](./authentication/README.md)
4. [`authentication/design.md`](./authentication/design.md)
5. [`authentication/requirements.md`](./authentication/requirements.md)
6. [`authentication/tasks.md`](./authentication/tasks.md)

### Prerequisites

- **A1 frozen:** users/orgs/credential_bindings shape

### Your scope (in `packages/auth`)

- **`org_memberships`** RBAC (not `users.role`) — ADR-009 single binding per MCP for MVP
- Phase 1: API keys + local env/keychain secrets; defer OIDC to Phase 2; **defer OAuth auth-code to Phase 4**
- Credential resolver interface + in-memory stub
- Auth types for MVP: apiKey, bearer, basic, custom, oauth2_cc

### Must freeze early (unblocks A3)

Publish the resolver interface + in-memory stub:

```typescript
interface CredentialResolver {
  resolve(bindingId: string): Promise<ResolvedCredential>;
  apply(credential: ResolvedCredential, request: HttpRequest): HttpRequest;
}
```

Stub returns fake secrets from an in-memory map for dev/test.

### Do NOT build

- HTTP route handlers (that's A6), UI login screens (that's A7/A8), MCP server

### Done when

- RBAC via org_memberships enforced
- Secret write-only: no read-back path exists
- Runtime (A3) can authenticate apiKey + oauth2_cc calls via resolver

### Sub-agent split

- **AU1:** platform AuthN/AuthZ (OIDC, API keys, RBAC, visibility middleware)
- **AU2:** secrets + bindings + resolver + OAuth flows + redaction

---

## A5 — registry

**Role:** Domain library for catalog, publish, discovery payloads, install snippets. **No HTTP** (ADR-011).

### Read first

1. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — ADR-006, ADR-008, ADR-010, ADR-011
2. [`data-structure/design.md`](./data-structure/design.md) — versions, manifests, tools, install_targets, discovery view
3. [`registry/README.md`](./registry/README.md)
4. [`registry/design.md`](./registry/design.md)
5. [`registry/requirements.md`](./registry/requirements.md)
6. [`registry/tasks.md`](./registry/tasks.md)

### Prerequisites

- **A1 frozen:** data model + discovery view + `@mcp-definer/schemas` validator
- **A4 stub:** publish authz (allow-all for dev)

### Your scope (in `packages/registry` + `packages/cli`)

- Domain functions: publish, catalog, search, discovery index v1 payload builders
- Install snippet builder per ADR-008 (global runtime + manifest URL)
- **`packages/cli`:** `mcp-definer install`, `list`, `validate`
- Call `validateManifest()` from `@mcp-definer/schemas` on publish — do not reimplement

### Must freeze early (unblocks A6)

- `fixtures/registry/index-v1.json` + `buildInstallSnippet()` function
- Manifest fetch helpers for `{org}/{slug}/versions/{ver}`

### Do NOT build

- HTTP routes (A6 owns all HTTP), UI, spec parsing, MCP server

### Done when

- Publish → discover → install loop works with A1 fixtures
- Published versions immutable; audit events emitted
- Index is ETag'd and cache-friendly

### Sub-agent split

- **RG1:** publish, versioning, catalog, search
- **RG2:** discovery index, manifest serving, install targets, CLI

---

## A6 — api-design

**Role:** **Sole HTTP server** (`packages/api`). Routes call registry/generator/auth/request-pipeline.

### Read first

1. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — ADR-011, ADR-012
2. [`DEPENDENCIES.md`](./DEPENDENCIES.md) — you orchestrate almost everything
3. [`api-design/README.md`](./api-design/README.md)
4. [`api-design/design.md`](./api-design/design.md) — full endpoint catalog
5. [`api-design/requirements.md`](./api-design/requirements.md)
6. [`api-design/tasks.md`](./api-design/tasks.md)

### Prerequisites

- **A1 frozen:** entity shapes
- **A4:** authn/authz middleware (real or stub)
- **Stubs for:** A2 (parse/regenerate), A5 (registry functions), A4 (auth)

### Your scope (in `packages/api`)

- All HTTP routes; delegate to registry (library), generator, auth
- `:invoke` uses **`@mcp-definer/request-pipeline`** from A3 — same SSRF rules as runtime (ADR-012)
- ETag/caching on discovery reads; mock server for A7/A8

### Must freeze early (unblocks A7, A8)

- Published OpenAPI doc
- Running mock server returning realistic fixtures for all UI-needed endpoints
- Auth scheme documented (how UI obtains tokens)

### Do NOT build

- UI, MCP server, spec parsing logic (delegate), vault (delegate)

### Done when

- Contract published; all endpoints implemented (real or delegated)
- `PATCH` on published version → 409
- No endpoint leaks secret values
- Mock server unblocks UI development

### Sub-agent split

- **AP1:** control plane endpoints
- **AP2:** discovery endpoints + caching

---

## A7 — ui-ux (authoring wizard)

**Role:** The create/edit flow. Import spec → curate → auth → validate → publish.

### Read first

1. [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — NFR-10 (LLM-facing metadata quality)
2. [`ui-ux/README.md`](./ui-ux/README.md)
3. [`ui-ux/design.md`](./ui-ux/design.md) — wizard steps + IA
4. [`ui-ux/requirements.md`](./ui-ux/requirements.md)
5. [`ui-ux/tasks.md`](./ui-ux/tasks.md) — tasks 1–2 (app shell + wizard)
6. [`api-design/design.md`](./api-design/design.md) — endpoints you call

### Prerequisites

- **A6 frozen:** OpenAPI contract + mock server (or real API)
- **A4 stub:** login/session (or mock auth)

### Your scope

- App shell: React + TS + Vite, routing, TanStack Query, auth wiring
- JSON-Schema-driven form renderer (reused by A8 test console — coordinate on this component)
- Wizard: import → preview → curate → auth config → validate → publish
- "How the agent sees this" preview panel (NFR-10)
- Metadata quality guidance (warn on empty/poor descriptions)
- Write-only secret entry for credential bindings

### Do NOT build

- MCP list/detail, test console, registry browse (that's A8)
- Backend endpoints

### Done when

- User completes spec → curate → auth → validate → publish against mock/real API
- Large spec (300 ops) manageable via filter/group
- No secret value ever rendered on screen

---

## A8 — ui-ux (management, test console, registry browse)

**Role:** Everything after initial creation. List, manage, test, discover, install.

### Read first

1. [`ui-ux/README.md`](./ui-ux/README.md)
2. [`ui-ux/design.md`](./ui-ux/design.md) — manage, test console, registry sections
3. [`ui-ux/requirements.md`](./ui-ux/requirements.md)
4. [`ui-ux/tasks.md`](./ui-ux/tasks.md) — tasks 3–6
5. [`api-design/design.md`](./api-design/design.md)

### Prerequisites

- **A6 frozen:** OpenAPI contract + mock server
- **A7 (soft):** shared app shell + JSON-Schema form renderer — coordinate or duplicate minimally

### Your scope

- MCP list (search/filter/sort + row actions)
- MCP detail (version history, capabilities, audit, install instructions)
- Regeneration diff view
- Test console: tool picker → schema form → `:invoke` → request/response/status/timing
- Registry browse + install panel (harness/transport/snippet/CLI)
- RBAC-aware action gating + visibility

### Do NOT build

- Create wizard (A7), backend endpoints

### Done when

- List/detail/test/browse flows work against mock/real API
- Test console invokes a tool and shows results (secret-safe)
- RBAC hides/disables actions correctly

---

## A9 — integration (mandatory)

**Role:** Wire real implementations; contract + E2E tests. **Not optional.**

### Read first

- [`TESTING.md`](./TESTING.md)
- [`BUILD_PLAN.md`](./BUILD_PLAN.md) — definition of done
- [`DEPENDENCIES.md`](./DEPENDENCIES.md)

### Scope

- Replace stubs with real module wiring in `packages/api`
- Implement full contract test suite (`pnpm contract-test`)
- E2E per TESTING.md: spec → publish → discover → install → runtime → tool call
- Verify `:invoke` and runtime use identical request-pipeline behavior
- Fix contract mismatches; file ADRs for any schema changes

### Done when

- All tests in TESTING.md pass in CI
- End-to-end loop demonstrated on Petstore fixture

---

## Quick reference: which brief for which agent?

| Agent ID | Brief section                                                               | Package(s)                                      |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| A0       | [A0 — platform bootstrap](#a0--platform-bootstrap)                          | monorepo root                                   |
| A1       | [A1 — data-structure](#a1--data-structure)                                  | `packages/schemas`, `packages/db`               |
| A2       | [A2 — generator](#a2--generator)                                            | `packages/generator`                            |
| A3       | [A3 — runtime](#a3--runtime)                                                | `packages/runtime`, `packages/request-pipeline` |
| A4       | [A4 — authentication](#a4--authentication)                                  | `packages/auth`                                 |
| A5       | [A5 — registry](#a5--registry)                                              | `packages/registry`, `packages/cli`             |
| A6       | [A6 — api-design](#a6--api-design)                                          | `packages/api`                                  |
| A7       | [A7 — ui-ux authoring](#a7--ui-ux-authoring-wizard)                         | `apps/web`                                      |
| A8       | [A8 — ui-ux management](#a8--ui-ux-management-test-console-registry-browse) | `apps/web`                                      |
| A9       | [A9 — integration](#a9--integration-mandatory)                              | `tests/`, CI                                    |
