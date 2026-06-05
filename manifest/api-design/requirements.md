# API Design — Requirements

Refines [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional

- AR-01 `POST /v1/specs:parse` returns IR + discovered operations without persisting (FR-01–FR-03).
- AR-02 CRUD for MCPs and versions; create-from-parsed-spec (FR-04, FR-05, FR-10).
- AR-03 Draft versions editable via `PATCH`; published versions return `409` (FR-11, ADR-006).
- AR-04 `:validate`, `:publish`, `:deprecate`, `:regenerate` action endpoints (FR-08, FR-10, FR-12, FR-17).
- AR-05 `:invoke` endpoint for in-UI test console (FR-09).
- AR-06 Credential binding management with write-only secrets (FR-06, FR-07).
- AR-07 Discovery endpoints: index, per-MCP detail, manifest fetch, install, search (FR-13, FR-14, FR-15).
- AR-08 Audit query endpoint (FR-18).

## Non-Functional

- AR-N1 Discovery reads ETag'd + CDN-frontable (NFR-08, NFR-12).
- AR-N2 AuthN/AuthZ on control plane; scoped access for discovery by visibility (NFR-05).
- AR-N3 Secret values never returned by any endpoint (NFR-02, ADR-004).
- AR-N4 All mutations audited (NFR-07).
- AR-N5 Cursor pagination; structured error responses with field-level validation detail.

## Acceptance criteria

- OpenAPI/contract doc generated for the API surface.
- `PATCH` on a published version yields `409`.
- No endpoint response ever contains a secret value.
- Discovery index serves a cached, convention-aligned payload consumable by Cursor.
