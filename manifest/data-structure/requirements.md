# Data Structure — Requirements

Refines system requirements in [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional
- DR-01 Define IR schema covering operations, params, request/response bodies, security schemes (supports FR-03).
- DR-02 Define Manifest schema covering tools, resources, prompts, auth binding, transport, policies (supports FR-04, FR-16).
- DR-03 Manifest `inputSchema` per tool is valid JSON Schema (supports FR-08).
- DR-04 Relational model for orgs, users, **org_memberships**, mcps, **source_specs**, versions, manifests, **curation_profiles**, tools, bindings, tags, install targets, audit events (supports FR-10–FR-20, FR-17).
- DR-05 Enforce immutability of published versions/manifests at the data layer (supports FR-11, ADR-006).
- DR-06 Provide a discovery read view/materialized view for the index endpoint (supports FR-14, NFR-08).
- DR-07 Persist three independent version axes (supports NFR-11).
- DR-08 Denormalize tools per version to enable capability search (supports FR-13).
- DR-09 Provide migration mechanism for `manifestSchemaVersion` changes.

## Non-Functional
- DR-N1 Deterministic Manifest serialization (stable key order) for clean diffs (NFR-06).
- DR-N2 No secret values stored outside the dedicated secrets store; only `secret_ref`/binding metadata (NFR-02, ADR-004).
- DR-N3 Indexes support sub-second catalog search at target scale (NFR-08, NFR-12).
- DR-N4 Shared, generated type definitions for IR + Manifest reused by all TS components (NFR-13).

## Acceptance criteria
- A Manifest validates against the published JSON Schema and round-trips through serialize/parse byte-identically.
- Attempting to mutate a published version/manifest is rejected at the data/service layer.
- The discovery view returns a published MCP with its tool summary in a single query.
