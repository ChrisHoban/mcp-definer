# Registry — Design

## Publish flow (FR-10, ADR-006)
```
draft version (valid Manifest)
  → :validate (re-run shared validator + conformance)
  → assign semver + channel
  → freeze: set published_at, mark manifest immutable
  → (optional) sign artifact → store signature
  → refresh discovery read view
  → emit audit event
```
Mutation of a published version returns `409` (enforced at data layer, see data-structure).

## Versioning & channels
- **Semver** per MCP (`mcp_versions.version`).
- Channels: `stable`, `beta` (and `draft` pre-publish).
- Consumers may **pin** a version or track a channel's latest.
- **Deprecate/retire**: mark a version deprecated; keep it resolvable for pinned consumers; surface warnings in discovery.

## Catalog & search (FR-13)
- Backed by the denormalized `tools` table + FTS/trigram indexes (data-structure).
- Filter by tag, capability (tool name), visibility, channel, maturity.
- Cursor-based pagination.

## Discovery index v1 schema (ADR-010)

Internal v1 format until official MCP registry conventions are pinned. The API serves this at `GET /v1/index`.

```jsonc
{
  "indexVersion": "1.0",
  "generatedAt": "2026-06-04T12:00:00Z",
  "entries": [
    {
      "org": "acme",
      "slug": "petstore",
      "name": "Petstore API",
      "description": "MCP for the Petstore API",
      "visibility": "public",
      "latestVersion": "1.0.0",
      "channel": "stable",
      "mcpProtocolVersion": "2024-11-05",
      "toolCount": 12,
      "toolNames": ["getPetById", "listPets"],   // summary; full list on detail endpoint
      "tags": ["pets", "demo"],
      "installUrl": "/v1/registry/acme/petstore/install?harness=cursor",
      "manifestUrl": "/v1/registry/acme/petstore/versions/1.0.0/manifest"
    }
  ],
  "nextCursor": null
}
```

Fixture: `fixtures/registry/index-v1.json`. When official registry formats emerge, add `indexVersion: "2.0"` adapter — do not silently break v1.

## Distribution / install (FR-15, ADR-008)

Per ADR-008, install targets reference the **global runtime** + manifest URL:

```jsonc
// install_targets.config_snippet for Cursor stdio
{
  "command": "npx",
  "args": ["-y", "@mcp-definer/runtime", "--manifest", "{{manifestUrl}}"],
  "env": {
    "{{secretEnvVar}}": "<set locally at install; never in registry>"
  }
}
```

- **CLI** (`packages/cli`, `mcp-definer install acme/petstore`): resolves version, fetches snippet, merges into Cursor `mcp.json`, prompts for credential env vars.
- Registry exports `buildInstallSnippet(mcp, version, harness)`; CLI and API both call it.

## Discovery index (ADR-007, FR-14)
- A read-optimized endpoint returning the catalog (public/org-scoped) with a capabilities summary per MCP.
- **Cache-first**: ETags, CDN-frontable; backed by the materialized discovery view, refreshed on publish/deprecate.
- **Convention-aligned** with emerging MCP registry formats so Cursor and other harnesses can consume it directly.
- Per-MCP detail exposes versions, channels, tools, and install targets.

## Distribution / install (FR-15)
- **Install targets** per version + harness (`cursor`/`claude-desktop`/`generic`) with a `config_snippet` and `instructions`.
- Snippets follow ADR-008: global `@mcp-definer/runtime` + manifest URL.
- **CLI** in `packages/cli`: `install <org/slug[@version]> --harness cursor` — merges harness config, prompts for credential env vars.

## Trust & governance (later phase — NFR-04)
- Publish authorization via RBAC (authentication component).
- Optional **signing** of published Manifests; consumers verify provenance.
- Org policies on who/what can be published to which channel/visibility.

## Storage
- Metadata + manifests in PostgreSQL (data-structure); large blobs (ejected code bundles) in object storage, referenced by URL.

## Caching strategy (NFR-08, NFR-12)
- Discovery view materialized + cached; invalidated on publish/deprecate.
- Per-MCP detail and Manifest fetch responses are ETag'd for harness/runtime caching.
