# Registry — Requirements

Refines [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional

- RG-01 Publish a draft version → immutable, semver'd, channel-assigned version (FR-10, ADR-006).
- RG-02 Re-validate on publish (shared validator + conformance) (FR-08).
- RG-03 Deprecate/retire versions and archive MCPs; keep pinned versions resolvable (FR-12).
- RG-04 List/search/filter catalog by name, description, tags, capabilities (FR-13).
- RG-05 Expose a cache-first discovery index aligned with MCP registry conventions (FR-14, ADR-007).
- RG-06 Expose per-MCP detail (versions, channels, tools, install targets).
- RG-07 Serve Manifests by reference for the Runtime to load (FR-16 dependency).
- RG-08 Provide per-harness install snippets + a CLI install that writes harness config (FR-15).
- RG-09 (Later) Sign published artifacts; support verification (NFR-04).

## Non-Functional

- RG-N1 Discovery is read-heavy: ETag/CDN-frontable, sub-second reads (NFR-08, NFR-12).
- RG-N2 Immutability of published versions enforced (NFR-06, ADR-006).
- RG-N3 No secrets in any registry artifact; respect visibility scoping (NFR-02, ADR-004, NFR-05).
- RG-N4 Publish gated by RBAC; all publish/deprecate events audited (NFR-05, NFR-07).

## Acceptance criteria

- Publishing freezes the version; further edits return `409`.
- A harness can read the discovery index and install an MCP via the CLI in one step.
- The Runtime can fetch a published Manifest by reference and serve it.
