# Generator — Design

## Pipeline

```
spec (file/url/text)
   → [1] ingest + format detect
   → [2] parse + validate + dereference            → raw spec model
   → [3] normalize                                  → IR  (data-structure)
   → [4] map operations → tools (+resources/prompts)→ draft Manifest
   → [5] apply curation overrides                   → curated Manifest
   → [6] mitigate tool explosion                    → final Manifest
   → [7] validate (conformance + JSON Schema)       → publishable Manifest
```

## [2] Parsing & normalization

- Libraries: `@apidevtools/swagger-parser` / `openapi-types`; `ajv` for JSON Schema.
- Support OpenAPI 3.0/3.1 + Swagger 2.0 (FR-02). Architecture pluggable for GraphQL/gRPC/AsyncAPI/Postman later.
- Handle messy specs: missing `operationId` (derive from method+path), absent schemas (fallback to permissive object), vendor `x-*` extensions (preserve as hints).

## [4] Mapping engine (core)

### Operation → Tool name

- Prefer `operationId`; else derive stable name from method + path (e.g. `GET /users/{id}` → `getUserById`).
- Ensure collision-free, identifier-safe names; record a deterministic disambiguation rule.

### Parameters → inputSchema

- Merge **path + query + header params + request body** into a single JSON Schema `object`.
- Preserve `required`, types, enums, descriptions. Record each property's origin in `request.paramMap` (`path`/`query`/`header`/`body`).
- Name collisions across param locations resolved deterministically (documented suffix rule).

### Request mapping

- Capture `method`, `pathTemplate`, `paramMap`, and `bodyParam` so the Runtime can rebuild the HTTP call.

### Response shaping

- Default `passthrough`. Options: `summarize` (trim large payloads) or `jsonpath` (extract). Map error statuses (`raise` vs return).

### Primitive selection (ADR-003)

- Default: tool. Read-only/listable GETs may _also_ be offered as resources. Common workflows may be authored as prompts.

## [5] Curation overrides

Author choices (from UI) are persisted in **`curation_profiles`** (data-structure), keyed to the draft `mcp_version_id`. Applied deterministically when compiling IR → Manifest:

- include/exclude operations; rename tools; edit descriptions (LLM-facing, NFR-10); regroup; edit/tighten input schemas; set response shaping; set pagination/rate-limit hints.

On `:regenerate`, load the stored curation profile + new `source_specs` content → re-map → diff.

## MVP scope exclusions (Phase 1)

The following OpenAPI features are **out of scope for MVP**; specs containing them produce warnings, not hard failures, with best-effort fallback:

- `oneOf` / `anyOf` / `allOf` (flatten to generic object or first branch)
- `multipart/form-data`, file uploads, binary request/response bodies
- Complex query serialization (`style`, `explode`, deep objects, array params)
- Multiple `servers` (use first server only)
- Operation-level security overrides (ADR-009: MCP-level binding used for all ops)
- Webhooks, async operations, streaming responses, GraphQL, gRPC

Document supported subset in generator README; expand in Phase 5.

## [6] Tool-explosion mitigation (ADR-003 consequence)

For large APIs (e.g. 300 operations):

- **Filtering** — exclude by tag/path/method; default-disable rarely used ops.
- **Grouping** — `tool.group` to organize.
- **Meta-tools** — optional `search_tools` / `invoke_operation` pattern so the agent discovers operations on demand instead of loading hundreds of tools.

## [7] Validation (FR-08)

- JSON Schema validity of each `inputSchema`.
- Call **`validateManifest()` from `@mcp-definer/schemas`** (owned by data-structure — generator does not own the validator).
- MCP conformance checks (tool naming, required fields).
- Returns structured errors + warnings to the UI/API.

## Determinism (NFR-06)

- No randomness; stable sorting of tools/properties; canonical JSON output. Same `(IR, curation)` → identical Manifest bytes.

## Regeneration & diff (FR-17)

- Re-parse new spec → new IR → re-map, **re-applying stored curation** where operations still match (by stable id).
- Produce a structured diff (added/removed/changed tools, schema changes) for author review before publishing a new version.
