# Registry — Tasks

Depends on [`data-structure/`](../data-structure/) (versions, manifests, discovery view) and [`api-design/`](../api-design/) (endpoints).

## 1. Publish & versioning

- [ ] Implement publish transition (validate → semver/channel → freeze → audit).
- [ ] Enforce immutability (with data-structure layer).
- [ ] Deprecate/retire + archive; keep pinned versions resolvable.

## 2. Catalog & search

- [ ] List/search/filter (tags, capabilities, visibility, channel) with cursor pagination.

## 3. Discovery index

- [ ] Build cache-first index endpoint backed by the materialized discovery view.
- [ ] Align response shape with MCP registry conventions; add ETag/caching.
- [ ] Per-MCP detail endpoint (versions/channels/tools/install targets).

## 4. Manifest serving

- [ ] Serve published Manifest by reference for the Runtime; ETag it.

## 5. Distribution / install

- [ ] `buildInstallSnippet()` per ADR-008 (global runtime + manifest URL).
- [ ] **`packages/cli`:** `install`, `list`, `validate` commands.
- [ ] Fixture: `fixtures/registry/index-v1.json`.

## 6. Governance (later)

- [ ] Publish RBAC gating; audit events.
- [ ] Artifact signing + verification.

## Definition of done

- Publish → discover → install → run loop works end-to-end; index is cached; immutability + audit enforced.
