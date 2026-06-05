# Architecture Decisions & Cross-Cutting Concerns

This document records **binding, system-wide decisions**. Component designs must conform to these. Decisions use lightweight ADR format.

---

## ADR-001: Manifest-driven universal runtime

**Decision.** The system is anchored on a declarative **Manifest** as the source of truth. A single **Universal Runtime** loads any Manifest and serves it as an MCP server. Per-API code generation is a later, optional "eject" export.

**Alternatives considered.**

- _Pure code generation per API_ — fully customizable but heavy to maintain, causes version sprawl, hard to centrally control.
- _Pure runtime interpretation_ — easy to create/update and version, but less customizable and depends on a central runtime.
- _Hybrid_ — chosen end-state: Manifest is source of truth; codegen is an export path.

**Rationale.** The manifest-driven model makes the UI, registry, and generator dramatically simpler, enables trivial create/update and clean versioning, and keeps a single contract at the center. Codegen can be added later without reworking the core.

**Consequences.** The Manifest schema is the most important contract in the system (owned by [`data-structure/`](./data-structure/)). The Universal Runtime is a critical dependency and must be robust, observable, and secure.

---

## ADR-002: TypeScript end-to-end

**Decision.** Use **TypeScript/Node** across runtime, generator, control-plane API, and UI.

**Rationale.** The most mature MCP SDK is TypeScript; shared IR/Manifest types across all components (NFR-13); single talent pool. Python remains a viable alternative for teams that prefer it (its MCP SDK is also first-class), but TS is the default.

**Consequences.** Shared types package for IR + Manifest. UI and API can use tRPC or typed REST clients.

---

## ADR-003: Operation → Tool mapping as the default primitive

**Decision.** Each API operation maps to one MCP **tool** by default. Read-only/listable operations may additionally be exposed as **resources**. Common multi-step workflows may be offered as **prompts**.

**Consequences.** Large APIs cause "tool explosion." Mitigations are mandatory: filtering, grouping, and optional meta-tools for search/select (see [`generator/`](./generator/)).

---

## ADR-004: Secrets never live in Manifests

**Decision.** Manifests reference a **credential binding** by id. Secret values live only in a vault (hosted) or OS keychain/env (local), injected at runtime.

**Consequences.** Registry, API responses, and exported Manifests are safe to share. The Runtime resolves secrets at call time. See [`authentication/`](./authentication/).

---

## ADR-005: Two planes — control vs. runtime

**Decision.** Separate the **control plane** (UI, API, generator, registry — authoring & publishing) from the **runtime/data plane** (Universal Runtime executing MCP servers and calling target APIs, locally or hosted).

**Consequences.** Clear security boundary; the control plane never needs target-API secrets at runtime when execution is local.

---

## ADR-006: Immutable published versions, semver, channels

**Decision.** Drafts are mutable; **published versions are immutable** and semver'd. Channels: `stable`, `beta`. Mutation attempts on published versions return `409`.

**Consequences.** Consumers can pin versions safely; regeneration creates new versions with a reviewable diff (FR-17).

---

## ADR-007: Discovery index is cache-first and convention-aligned

**Decision.** The discovery/index endpoint is read-optimized (ETag/CDN-frontable) and aligns with emerging **MCP registry** conventions so Cursor and other harnesses can consume it directly.

**Consequences.** See [ADR-010](#adr-010-discovery-index-format-v1) for the pinned v1 schema used until official registry conventions stabilize.

---

## ADR-008: Global runtime distribution

**Decision.** The Universal Runtime is a **single global install** (`@mcp-definer/runtime` via npm or a standalone binary), installed once per machine. Each MCP is a **Manifest reference**, not a separate server binary.

**Install model (Cursor stdio).**

```jsonc
{
  "mcpServers": {
    "petstore": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp-definer/runtime",
        "--manifest",
        "https://registry.example.com/v1/registry/acme/petstore/versions/1.0.0/manifest",
      ],
      "env": { "MCP_DEFINER_SECRET_cb_123": "<user-supplied at install>" },
    },
  },
}
```

Manifest sources: registry URL (preferred), local file path (`--manifest ./petstore.json`), or env var (`MCP_DEFINER_MANIFEST_URL`).

**Consequences.** Registry install snippets always reference the global runtime + manifest URL. CLI `install` merges this into Cursor config and prompts for credential env vars. MVP is **local stdio only**; hosted multi-tenant runtime is Phase 4+.

---

## ADR-009: MVP — single auth binding per MCP

**Decision.** v1 supports **one credential binding per MCP**, applied to all tool calls. OpenAPI operation-level security overrides and multiple security schemes are **ignored** in MVP; the MCP-level binding is used uniformly.

**Consequences.** Generator maps the spec's primary/default security scheme to the binding. Per-operation auth differences are a future ADR. Simplifies Manifest, runtime, and UI.

---

## ADR-010: Discovery index format v1

**Decision.** Until official MCP registry conventions stabilize, we publish an **internal v1 discovery schema** aligned with Cursor install needs. Documented in [`registry/design.md`](./registry/design.md#discovery-index-v1-schema). When an official schema is adopted, add a versioned adapter — do not break v1 consumers without migration.

**Pinned protocol version.** `mcpProtocolVersion: "2024-11-05"` — matches the MCP SDK revision targeted by `@modelcontextprotocol/sdk` at implementation time. Update via ADR when upgrading the SDK.

---

## ADR-011: Registry is domain layer; API owns HTTP

**Decision.** `packages/registry` is a **service/domain library** (no HTTP server). `packages/api` is the **sole HTTP entry point** for control plane and discovery. Registry exports functions; API routes call them.

**Consequences.** A5 builds library code; A6 owns routes, middleware, caching headers. No duplicate HTTP surfaces.

---

## ADR-013: Credential secrets via environment variables

**Decision.** Credential **binding metadata** (auth type, apply config, `secretRef`) is persisted in Postgres when the registry uses Postgres. **Secret values are never stored** in the database, Manifest, or registry API responses. Each binding’s `secretRef` uses the `env:` scheme pointing at `MCP_DEFINER_SECRET_{bindingId}` (same convention as Cursor install snippets in ADR-008).

**Deployment.** Operators set secrets in the runtime/control-plane environment (Kubernetes secrets, Docker env, `.env` locally). The API may accept a one-time `secret` on `POST /credentials` to populate the **current process** env for dev ergonomics; production relies on externally injected env vars.

**Consequences.** Restarting the API without env vars configured yields `hasSecret: false` until vars are set. Phase 4 may add vault/keychain backends as alternate `secretRef` schemes without changing Manifests.

---

## ADR-014: Remote OpenAPI URL import (SSRF controls)

**Decision.** `POST /v1/specs/parse` may fetch a spec from `url` when `SPEC_FETCH_ALLOWLIST` is configured (comma-separated host allow-list, same host-matching rules as egress allow-list).

**Controls.**

| Control           | Default                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| Allow-list        | **Required** — empty list rejects all URL fetches                              |
| Protocol          | `http:` and `https:` only                                                      |
| Blocked targets   | Private/reserved IPs, `localhost`, `*.local`, `*.internal`, metadata endpoints |
| Max response size | 5 MiB                                                                          |
| Timeout           | 30 s                                                                           |
| Redirects         | Max 3; each redirect URL re-validated                                          |

**Consequences.** UI and API document the allow-list requirement. Operators add trusted hosts (e.g. `raw.githubusercontent.com`) per environment.

---

## ADR-012: Shared request pipeline for runtime and `:invoke`

**Decision.** Outbound HTTP execution (build request, apply auth, enforce egress allow-list, retries, response shaping) lives in **`packages/request-pipeline`**, shared by the Universal Runtime and the API's `:invoke` test endpoint.

**Consequences.** SSRF protection (NFR-03) applies equally to runtime tool calls and control-plane test invocations. Neither component reimplements HTTP policy logic.

---

## Cross-cutting concerns (apply to all components)

### Security

- Secret isolation (ADR-004), egress allow-listing/SSRF protection for runtime calls (NFR-03), optional artifact signing (NFR-04), supply-chain hygiene, sandboxed execution.

### Versioning strategy (three independent axes — NFR-11)

- **MCP protocol version** (what the runtime speaks).
- **Target-API version** (from the source spec).
- **Manifest schema version** (our internal contract).

### Observability

- Structured logs, OpenTelemetry tracing spanning tool-call → outbound API call, and an audit trail for all authoring/publish events (NFR-07).

### Multi-tenancy & AuthZ

- Org-scoped resources; RBAC roles owner/admin/author/viewer; visibility private/org/public (NFR-05, FR-20).

### Determinism & reproducibility

- Spec → Manifest generation must be deterministic (same input → same output) to produce clean diffs (NFR-06).

### Known risks to manage

- Poor/incomplete real-world specs (need an editing/fallback layer).
- Tool explosion on large APIs (filtering/grouping/meta-tools).
- OAuth user-delegated flows are the hardest auth case.
- Registry trust/governance (who can publish; verification).
- Stateful/non-REST APIs (pagination, long-running ops, webhooks, streaming).
- Spec drift over time (regeneration + diff).
