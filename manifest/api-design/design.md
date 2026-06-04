# API Design — Design

Two groups: **Control Plane** (authenticated authoring/management) and **Discovery** (consumption). Default style: typed REST (tRPC optional for the TS UI). Transport: JSON over HTTPS.

## Conventions
- **Versioning:** URL-prefixed `/v1`. Resource versions are semver in the path.
- **Actions:** `:verb` suffix for state transitions (`:publish`, `:validate`, `:invoke`, `:regenerate`, `:deprecate`).
- **Immutability:** `PATCH` on a published version → `409 Conflict`.
- **Pagination:** cursor-based (`?cursor=&limit=`).
- **Caching:** discovery reads are ETag'd + CDN-frontable.
- **Auth:** control plane via OAuth2/OIDC + API keys (CLI); discovery public for `visibility=public`, scoped tokens for `org`/`private`. See [`authentication/`](../authentication/).
- **Secrets:** write-only request fields; never returned. Responses include only `secret_ref` / binding metadata.
- **Errors:** structured problem responses (code, message, field-level details from validation).

## Control Plane — authoring & management

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/specs:parse` | Upload/URL/paste a spec → normalized IR + discovered operations (no persistence). Drives create-flow preview. |
| `POST` | `/v1/mcps` | Create an MCP (draft) from parsed spec + curation. |
| `GET` | `/v1/mcps` | List MCPs (filter status/visibility/tag; paginated). |
| `GET` | `/v1/mcps/{id}` | MCP detail + latest version summary. |
| `PATCH` | `/v1/mcps/{id}` | Update metadata (name, description, visibility, tags). |
| `DELETE` | `/v1/mcps/{id}` | Archive/soft-delete (published versions remain). |
| `POST` | `/v1/mcps/{id}/versions` | Create a new draft version (manifest + curation). |
| `GET` | `/v1/mcps/{id}/versions` | List versions + channels. |
| `GET` | `/v1/mcps/{id}/versions/{ver}` | Version detail + manifest + tools. |
| `PATCH` | `/v1/mcps/{id}/versions/{ver}` | Edit a **draft** version. `409` if published. |
| `POST` | `/v1/mcps/{id}/versions/{ver}:validate` | Conformance + JSON Schema validation; returns errors/warnings. |
| `POST` | `/v1/mcps/{id}/versions/{ver}:publish` | Freeze + publish to a channel; optional signature. |
| `POST` | `/v1/mcps/{id}/versions/{ver}:deprecate` | Mark deprecated/retired. |
| `POST` | `/v1/mcps/{id}/versions/{ver}:regenerate` | Re-run spec→manifest on drift; returns a diff. |
| `POST` | `/v1/mcps/{id}/tools/{tool}:invoke` | In-UI test console: invoke a tool against the live API via a bound credential. |
| `GET` `POST` `DELETE` | `/v1/mcps/{id}/credentials` | Manage credential **bindings** (metadata + write-only secret). Values never returned. |
| `GET` | `/v1/audit` | Query audit events. |

## Discovery — consumption by harnesses

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/v1/index` | Catalog index: paginated public/org MCPs + capabilities summary. ETag'd, CDN-friendly, MCP-registry-convention-aligned. |
| `GET` | `/v1/registry/{org}/{slug}` | Per-MCP detail: versions, channels, tools, install targets. |
| `GET` | `/v1/registry/{org}/{slug}/versions/{ver}/manifest` | The Manifest the Universal Runtime loads. |
| `GET` | `/v1/registry/{org}/{slug}/install?harness=cursor` | Ready-to-use install snippet/config for the harness. |
| `GET` | `/v1/search?q=&tag=&capability=` | Search the catalog. |

## Orchestration notes
- `:parse`, version create, `:validate`, `:regenerate` → delegate to [`generator/`](../generator/).
- `:publish`, `:deprecate`, discovery/install → delegate to [`registry/`](../registry/) domain functions (ADR-011).
- `:invoke` → delegate to **`packages/request-pipeline`** (ADR-012) with manifest tool definition + resolved credential. **Must enforce the same egress allow-list and policies as the runtime.** Never implement ad-hoc HTTP in the API layer.
- All write actions emit audit events (NFR-07).

## `:invoke` security (ADR-012)

The test console is an SSRF vector if implemented naïvely. Requirements:
- Reuse `packages/request-pipeline` (same code path as runtime tool calls).
- Apply `manifest.policies.egressAllowlist` from the draft manifest being tested.
- Resolve credentials via authentication component (write-only secrets).
- Log/trace with redaction; never return secret values in response.
