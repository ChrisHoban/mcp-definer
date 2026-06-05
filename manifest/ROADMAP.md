# Roadmap & Phasing

Phases deliver product value; [`BUILD_PLAN.md`](./BUILD_PLAN.md) defines agent sequencing. **Phase 1 is CLI-first** (no UI required) to align with the build plan.

## Phase 1 — MVP: spec → runnable MCP (CLI + runtime)

**Goal:** An OpenAPI 3 spec becomes a working MCP in Cursor via CLI/runtime — **no web UI required.**

**Agents:** A0 → A1 → A2 + A3 + A4

- Platform: monorepo, docker, CI _(A0)_
- Data structure: Manifest + CurationProfile schema, validator, minimal DB _(A1)_
- Generator: OpenAPI 3 → IR → Manifest, default operation→tool mapping _(A2)_
- Runtime: Universal Runtime over **stdio** + `request-pipeline`; apiKey/bearer _(A3)_
- Auth: credential bindings + local secret resolution (env/keychain) _(A4)_
- Dev aid: `mcp-definer validate <manifest.json>` _(cli stub)_
- Install: manual Cursor `mcp.json` per ADR-008, or copy from generator output

_(FR-01–FR-07, FR-16 partial)_

## Phase 2 — Registry & discovery

**Goal:** Publish, version, discover, and install via index/CLI.

**Agents:** A5 + A6 (+ A9 integration tests)

- Registry domain + CLI install _(A5)_
- Control-plane + discovery HTTP API _(A6)_
- Publish, semver, immutable versions, discovery index v1 _(FR-10–FR-15, FR-18)_

## Phase 3 — Authoring depth (UI)

**Goal:** High-quality, curated MCPs via web UI.

**Agents:** A7 + A8

- Full create wizard, tool curation, auth config UX, test console _(FR-05, FR-06, FR-09)_
- Generator: tool-explosion mitigations; OAuth2 client-credentials _(FR-08, ADR-003)_
- List/manage, regeneration diff view _(FR-12, FR-13, FR-17)_

## Phase 4 — Hardening, scale, governance

**Goal:** Production readiness.

Assigned from post-MVP audit (see [`PHASE_4_SCOPE.md`](./PHASE_4_SCOPE.md)):

- **Authentication & tenancy:** OAuth2/OIDC login, sessions, scoped revocable API keys; enforce RBAC from `org_memberships` on every control-plane route; full multi-org tenancy _(AUTH-01–03, FR-20, NFR-05)_
- **Generator scale:** Meta-tools (`search_tools` / `invoke_operation`) and related tool-explosion mitigations beyond filters/groups _(GR-07, ADR-003)_
- **Runtime & install:** Streamable HTTP/SSE transport; HTTP install snippets; circuit-breaker, rate limiting, full policy suite _(FR-15, FR-16, NFR-06)_
- **Secrets & trust:** Hosted vault/KMS and OS keychain adapters (alternate `secretRef` schemes); optional artifact signing and verification _(NFR-04, AUTH-06, AUTH-10)_
- **Observability:** OpenTelemetry tracing (tool-call → upstream API); expanded audit for secret access _(NFR-07)_
- **Codegen:** "eject" standalone MCP server projects _(FR-19)_

## Phase 5 — Breadth

**Goal:** More inputs and lifecycle automation.

- Generator: GraphQL/gRPC/AsyncAPI; full OpenAPI edge cases _(FR-02)_

## Dependency ordering (critical path)

```
A0 platform → Manifest schema (A1)
        │
        ├── Generator (A2)
        ├── Runtime + request-pipeline (A3)
        └── Auth (A4)
                │
                ├── Registry + CLI (A5)
                └── API (A6)
                        │
                        └── UI (A7/A8) — Phase 3 only
                                │
                                └── Integration (A9)
```
