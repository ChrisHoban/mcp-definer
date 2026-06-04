# Data Structure Component

**Owns the two most central contracts in the system:** the **Manifest/IR schema** and the **persistence data model**. Every other component depends on this folder.

## Responsibilities

- Define the **Intermediate Representation (IR)**: normalized output of spec parsing.
- Define the **Manifest schema**: the declarative, versioned source-of-truth an MCP is built from and the Runtime executes.
- Define the **relational data model**: organizations, MCPs, versions, manifests, tools, credential bindings, tags, install targets, audit events.
- Define indexing/search strategy and the discovery read view.

## Dependencies

- **Consumes:** nothing (it is the foundation).
- **Consumed by:**
  - [`generator/`](../generator/) produces IR then Manifests.
  - [`runtime/`](../runtime/) executes Manifests + resolves credential bindings.
  - [`registry/`](../registry/) stores/serves Manifests and versions.
  - [`api-design/`](../api-design/) exposes these entities via REST.
  - [`ui-ux/`](../ui-ux/) edits Manifests and lists entities.
  - [`authentication/`](../authentication/) owns the *secret* side; this folder owns the *binding metadata* shape.

## Owned contracts

| Contract | File | Notes |
|---|---|---|
| Manifest schema (`manifest.content`) | [`design.md`](./design.md#manifest-schema) | Versioned by `manifest_schema_version`. Changes require an ADR. |
| CurationProfile schema | [`design.md`](./design.md#curation-profile-regeneration-source-of-truth) | Stored per draft version; enables FR-17 regeneration. |
| IR schema | [`design.md`](./design.md#intermediate-representation-ir) | Internal to Generator → Manifest. |
| **Manifest validator** (implementation + signature) | `packages/schemas` | **Owned here.** Generator/registry/api **call** it; they do not own it. |
| Relational model | [`design.md`](./design.md#relational-data-model) | PostgreSQL + JSONB. |

## Files
- [`design.md`](./design.md) — schemas and data model.
- [`requirements.md`](./requirements.md) — requirements for this component.
- [`tasks.md`](./tasks.md) — implementation tasks.

## Key principle
Secrets are **never** stored in the Manifest or in any table other than the dedicated secrets store. Manifests reference credentials by `binding_id` only (see [`ARCHITECTURE_DECISIONS.md`](../ARCHITECTURE_DECISIONS.md#adr-004-secrets-never-live-in-manifests)).
