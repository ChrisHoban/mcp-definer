# Registry / Index / Distribution Component

The versioned **catalog** of MCPs. Stores published Manifests, exposes discovery response shapes, and provides **one-step install** into harnesses (Cursor, etc.).

## Responsibilities
- **Publish**: freeze a draft version into an immutable, semver'd published version (optionally signed).
- **Versioning**: semver + channels (`stable`/`beta`); deprecate/retire; pinning.
- **Catalog & search**: list/search/filter by name, description, tags, capabilities (tool names).
- **Discovery index shapes**: define v1 response format (ADR-010); domain logic to build index payloads.
- **Distribution/install**: per-harness install snippets + CLI support functions.
- **Governance**: who can publish; trust/signing/verification (later phase).

## Does NOT own HTTP

Per ADR-011, registry is a **domain/service library** in `packages/registry`. The API (`packages/api`, agent A6) exposes HTTP routes that call registry functions. Registry does not start an HTTP server.

## Dependencies
- **Consumes:** [`data-structure/`](../data-structure/) (versions, manifests, tools, install_targets, discovery view); [`authentication/`](../authentication/) (publish authz, signing keys).
- **Consumed by:** [`api-design/`](../api-design/) (HTTP routes call registry); [`runtime/`](../runtime/) (fetch Manifest by reference); CLI (`packages/cli`); harnesses via API discovery endpoints.

## CLI

Install/distribution CLI lives in **`packages/cli`** (same agent scope as RG2 or A5). Registry exports install-snippet builders; CLI writes local harness config. See [`platform/`](../platform/) monorepo layout.

## Files
- [`design.md`](./design.md)
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)

## Key constraints
- Published versions/manifests are **immutable** (ADR-006).
- Discovery is **read-heavy** → cache-first, ETag'd, CDN-frontable (NFR-08).
- Registry artifacts contain **no secrets** (ADR-004) and are safe to share at the configured visibility.
