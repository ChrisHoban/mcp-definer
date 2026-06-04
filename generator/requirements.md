# Generator — Requirements

Refines [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional
- GR-01 Ingest spec via upload, URL, or pasted text; auto-detect format (FR-01).
- GR-02 Parse OpenAPI 3.0/3.1 and Swagger 2.0; dereference `$ref`s; resolve components (FR-02, FR-03).
- GR-03 Normalize parsed spec into the IR (FR-03).
- GR-04 Map each operation to an MCP tool with default name, description, and merged inputSchema (FR-04, ADR-003).
- GR-05 Capture request mapping (method, path template, param origins, body) for the Runtime (FR-16 dependency).
- GR-06 Apply author curation overrides deterministically (FR-05).
- GR-07 Provide tool-explosion mitigations: filter, group, meta-tools (ADR-003).
- GR-08 Validate Manifest (JSON Schema + conformance) and return structured errors/warnings (FR-08).
- GR-09 Regenerate from an updated spec and produce a reviewable diff, re-applying prior curation (FR-17).
- GR-10 Gracefully handle incomplete specs (missing operationId/schemas) with documented fallbacks.

## Non-Functional
- GR-N1 Deterministic output: identical input + curation → identical Manifest bytes (NFR-06).
- GR-N2 Never emit secrets; only auth binding references (NFR-02, ADR-004).
- GR-N3 Pluggable parser architecture to add GraphQL/gRPC/AsyncAPI later (FR-02).
- GR-N4 Generation runs as a queueable/worker job for large specs (NFR-08).

## Acceptance criteria
- A 300-operation OpenAPI spec produces a valid Manifest with mitigation options available.
- Re-running on an unchanged spec yields a byte-identical Manifest.
- Invalid specs produce actionable error messages rather than crashes.
