# Data Structure — Design

## Intermediate Representation (IR)

The IR is the normalized, source-format-agnostic result of parsing an API spec. It decouples the Generator's mapping logic from the input format (OpenAPI/Swagger/etc.).

```jsonc
// IR (conceptual shape)
{
  "irVersion": "1.0",
  "source": { "type": "openapi3", "hash": "sha256:...", "title": "Petstore", "version": "1.0.0" },
  "servers": [{ "url": "https://api.example.com/v1" }],
  "operations": [
    {
      "id": "getUserById", // stable, derived if operationId missing
      "method": "GET",
      "path": "/users/{id}",
      "summary": "Fetch a user",
      "description": "...",
      "tags": ["users"],
      "parameters": [
        { "in": "path", "name": "id", "required": true, "schema": { "type": "string" } },
        { "in": "query", "name": "expand", "required": false, "schema": { "type": "boolean" } },
      ],
      "requestBody": {
        "required": false,
        "contentType": "application/json",
        "schema": { "...": "..." },
      },
      "responses": [
        { "status": "200", "contentType": "application/json", "schema": { "...": "..." } },
      ],
      "security": ["apiKeyAuth"], // references named security schemes
    },
  ],
  "securitySchemes": {
    "apiKeyAuth": { "type": "apiKey", "in": "header", "name": "X-API-Key" },
  },
}
```

## Manifest schema

The Manifest is the **source of truth**: produced by the Generator, edited via the UI, versioned and stored by the Registry, and executed by the Runtime. It contains **no secrets**.

```jsonc
{
  "manifestSchemaVersion": "1.0",
  "mcpProtocolVersion": "2024-11-05", // MCP protocol revision; pin to @modelcontextprotocol/sdk version (ADR-008)
  "name": "petstore",
  "displayName": "Petstore API",
  "description": "MCP for the Petstore API",
  "targetApi": {
    "specType": "openapi3",
    "specHash": "sha256:...",
    "baseUrl": "https://api.example.com/v1",
    "baseUrlOverridable": true, // allow per-install override
  },
  "transport": { "modes": ["stdio", "http"], "default": "stdio" },
  "auth": {
    "bindingId": "cb_123", // FK to credential_bindings; NO secret values
    "type": "apiKey",
    "apply": { "in": "header", "name": "X-API-Key" },
  },
  "tools": [
    {
      "name": "getUserById",
      "description": "Fetch a user by id.", // LLM-facing; quality matters (NFR-10)
      "enabled": true,
      "group": "users",
      "inputSchema": {
        // JSON Schema: merged path+query+header+body
        "type": "object",
        "properties": {
          "id": { "type": "string", "description": "User id" },
          "expand": { "type": "boolean" },
        },
        "required": ["id"],
      },
      "request": {
        // how to build the HTTP call
        "method": "GET",
        "pathTemplate": "/users/{id}",
        "paramMap": {
          "id": { "in": "path" },
          "expand": { "in": "query" },
        },
        "bodyParam": null,
      },
      "response": {
        "shape": "passthrough", // passthrough | summarize | jsonpath
        "successStatus": ["200"],
        "errorMap": { "default": "raise" },
      },
      "pagination": null, // optional pagination descriptor
      "rateLimit": null,
    },
  ],
  "resources": [], // optional MCP resources
  "prompts": [], // optional MCP prompts
  "policies": {
    "timeoutMs": 30000,
    "retries": { "max": 2, "backoffMs": 200 },
    "egressAllowlist": ["api.example.com"], // SSRF protection (NFR-03)
  },
}
```

### Manifest design rules

- **Deterministic generation** (NFR-06): same IR + same curation → byte-identical Manifest (stable key ordering).
- **No secrets** (ADR-004): only `auth.bindingId` + non-secret apply-metadata.
- **Schema-versioned**: `manifestSchemaVersion` changes require an ADR + migration note.
- `inputSchema` must be valid JSON Schema (validated at publish, FR-08).

## Curation profile (regeneration source of truth)

Author overrides are stored separately from the compiled Manifest so regeneration (FR-17) can re-apply them when the upstream spec changes. The Generator reads a curation profile when mapping IR → Manifest.

```jsonc
{
  "curationVersion": "1.0",
  "excludedOperationIds": ["deletePet"],
  "toolRenames": { "getPetById": "fetchPet" },
  "toolDescriptions": { "getPetById": "Fetch a pet by ID for the agent." },
  "toolGroups": { "getPetById": "pets", "listPets": "pets" },
  "inputSchemaOverrides": {}, // optional per-tool JSON Schema patches
  "responseShapeOverrides": {},
  "filters": { "tags": ["pets"], "methods": ["GET", "POST"] },
  "metaToolsEnabled": false, // Phase 3: search_tools / invoke_operation
}
```

Stored in `curation_profiles` (one per draft version; copied forward on new version). Published versions snapshot the profile used at publish time (immutable copy).

## Relational data model

PostgreSQL. JSONB for flexible documents; relational columns for query/index.

```
organizations(id, slug, name, created_at)
users(id, email, display_name, created_at)
  -- no role column; roles are per-org via org_memberships

org_memberships(id, org_id→organizations, user_id→users, role, created_at)
  unique(org_id, user_id)
  -- role: owner | admin | author | viewer

mcps(id, org_id→organizations, slug, name, description,
     source_spec_type, source_spec_url(nullable), visibility,
     latest_version_id→mcp_versions(nullable), status,
     owner_id→users, created_at, updated_at)
  unique(org_id, slug)

source_specs(id, mcp_id→mcps, spec_hash, spec_type,
     content_text /*TEXT or null if stored externally*/,
     storage_ref /*nullable: s3://... for large specs*/,
     ingested_at, ingested_by→users)
  -- latest spec per MCP: highest ingested_at; supports FR-17 regeneration

mcp_versions(id, mcp_id→mcps, version /*semver*/, channel,
     manifest_id→manifests, curation_profile_id→curation_profiles,
     mcp_protocol_version, manifest_schema_version,
     source_spec_id→source_specs,   -- spec used to build this version
     changelog, published_at(nullable),
     signature(nullable), published_by→users)
  unique(mcp_id, version)

manifests(id, content /*JSONB*/, content_hash, created_at)

curation_profiles(id, mcp_version_id→mcp_versions, content /*JSONB*/,
     content_hash, created_at)
  -- mutable while version is draft; frozen snapshot on publish

tools(id, mcp_version_id→mcp_versions, name, description,
     input_schema /*JSONB*/, http_method, path_template, tags /*text[]*/)
  -- denormalized per version for search/listing

credential_bindings(id, mcp_id→mcps, auth_type,
     config /*JSONB, non-secret*/, secret_ref /*pointer into vault*/)

tags(id, org_id, label)
mcp_tags(mcp_id→mcps, tag_id→tags)   -- many-to-many

install_targets(id, mcp_version_id→mcp_versions, harness,
     transport, config_snippet /*JSONB*/, instructions)

audit_events(id, org_id, actor_id→users, action, target_type,
     target_id, metadata /*JSONB*/, created_at)
```

### Indexing & search strategy

- Full-text / trigram indexes: `mcps.name`, `mcps.description`, `tools.name`, `tools.description`.
- GIN indexes: `manifests.content`, `tools.input_schema`, `tools.tags`, `mcp_tags`.
- **Discovery read view**: a materialized/cached view joining `mcps` + `latest published mcp_versions` + `tools` summary, refreshed on publish; CDN-frontable (ADR-007).

### Immutability rules (ADR-006)

- A `mcp_versions` row with non-null `published_at` is immutable. Its `manifests` row is immutable.
- Draft versions (`published_at IS NULL`) are freely editable.

### Three version axes (NFR-11)

- `mcp_versions.version` — the MCP product version (semver).
- `mcp_versions.source_spec_hash` / target-API version — upstream API.
- `mcp_versions.manifest_schema_version` — our internal contract.

## Object storage

- Generated code bundles ("eject", FR-19) and large blobs stored in S3/MinIO, referenced by URL; not in Postgres.
