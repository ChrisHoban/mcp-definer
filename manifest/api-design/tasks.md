# API Design — Tasks

Depends on [`data-structure/`](../data-structure/); orchestrates generator/registry/runtime/auth.

## 1. Contract
- [ ] Author the API contract (OpenAPI) for control-plane + discovery surfaces.
- [ ] Define shared error model + pagination + auth scheme.

## 2. Control plane endpoints
- [ ] `/v1/specs:parse` (→ generator).
- [ ] MCP CRUD + version CRUD; enforce draft-vs-published immutability (`409`).
- [ ] Action endpoints: `:validate`, `:publish`, `:deprecate`, `:regenerate` (→ generator/registry).
- [ ] `:invoke` test console (→ runtime pipeline).
- [ ] Credential binding endpoints (write-only secrets → authentication).
- [ ] `/v1/audit` query.

## 3. Discovery endpoints
- [ ] `/v1/index` — call registry `buildIndex()`; ETag; v1 schema per ADR-010.
- [ ] `/v1/registry/...` detail + manifest fetch + install snippet.
- [ ] `/v1/search`.
- [ ] `:invoke` — delegate to `@mcp-definer/request-pipeline` (ADR-012); never ad-hoc fetch.

## 4. Cross-cutting
- [ ] AuthN/AuthZ middleware (control plane) + visibility-scoped discovery.
- [ ] Audit emission on all mutations.
- [ ] Caching/ETag layer for discovery.
- [ ] Verify no endpoint leaks secret values (test).

## Definition of done
- Contract published; endpoints implemented + delegated correctly; immutability + authz + audit + secret-safety verified by tests.
