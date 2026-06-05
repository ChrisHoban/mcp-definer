# System Requirements (Top-Level)

These are **system-wide** requirements. Component folders restate and refine the subset relevant to them. IDs are stable references (e.g. `FR-07`) usable across docs and tasks.

## Functional Requirements

| ID    | Requirement                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | Import an API spec via file upload, remote URL, or pasted text.                                                            |
| FR-02 | Support OpenAPI 3.0/3.1 and Swagger 2.0 at minimum; architecture must allow adding GraphQL/gRPC/AsyncAPI later.            |
| FR-03 | Parse and normalize a spec into an internal IR, resolving `$ref`s and components.                                          |
| FR-04 | Auto-generate a Manifest mapping each API operation to an MCP tool with sensible defaults.                                 |
| FR-05 | Allow manual curation: include/exclude operations, rename tools, edit descriptions and input schemas, group tools.         |
| FR-06 | Configure authentication per MCP (API key, bearer/JWT, OAuth2 client-credentials, OAuth2 auth-code, basic, custom header). |
| FR-07 | Bind credentials securely; secret values are write-only and never returned or stored in a Manifest.                        |
| FR-08 | Validate a Manifest against MCP conformance and JSON Schema before publish.                                                |
| FR-09 | Provide an in-UI test console to invoke a tool against the live target API before publishing.                              |
| FR-10 | Publish an MCP version with semantic versioning to a channel (stable/beta).                                                |
| FR-11 | Treat published versions as immutable; drafts are mutable.                                                                 |
| FR-12 | Deprecate/retire versions and archive MCPs.                                                                                |
| FR-13 | List, search, and filter the catalog by name, description, tags, and capabilities (tool names).                            |
| FR-14 | Expose a harness-consumable discovery index endpoint aligned with MCP registry conventions.                                |
| FR-15 | Provide one-step install into a harness (write Cursor config / CLI), per transport (stdio, HTTP).                          |
| FR-16 | Run a published Manifest as a live MCP server via the Universal Runtime over stdio and Streamable HTTP.                    |
| FR-17 | Regenerate an MCP when its source spec changes, producing a reviewable diff before re-publish.                             |
| FR-18 | Maintain version history and an audit trail of authoring/publishing actions.                                               |
| FR-19 | (Later) Eject a Manifest to a standalone runnable MCP server project.                                                      |
| FR-20 | Multi-tenancy: MCPs scoped to organizations with visibility (private/org/public).                                          |

## Non-Functional Requirements

| ID     | Category        | Requirement                                                                                                                           |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 | Conformance     | Strict adherence to the MCP spec and registry conventions; output works on any compliant harness. This is the core value proposition. |
| NFR-02 | Security        | Secrets isolated in a vault/keychain; never in Manifests or registry; least-privilege credentials.                                    |
| NFR-03 | Security        | SSRF protection / egress allow-listing for runtime HTTP calls; dependency supply-chain hygiene.                                       |
| NFR-04 | Security        | Optional signing of published artifacts; consumers can verify provenance.                                                             |
| NFR-05 | AuthZ           | RBAC with org-scoped roles (owner/admin/author/viewer); private vs public MCPs.                                                       |
| NFR-06 | Reliability     | Deterministic generation; immutable published versions; runtime retries/timeouts/circuit-breaking.                                    |
| NFR-07 | Observability   | Structured logging, distributed tracing of tool-call → API-call, full audit trail.                                                    |
| NFR-08 | Scalability     | Registry is read-heavy: cacheable/CDN-frontable index. Generation is bursty: queue/worker model.                                      |
| NFR-09 | Portability     | Runtime + generated servers run on Windows/macOS/Linux; both stdio and HTTP transports.                                               |
| NFR-10 | Usability       | Tool names/descriptions are LLM-facing; UX must drive high-quality metadata to improve agent tool-selection accuracy.                 |
| NFR-11 | Versioning      | Independently track MCP protocol version, target-API version, and Manifest schema version.                                            |
| NFR-12 | Performance     | Low cold-start for local stdio runtime; fast index reads.                                                                             |
| NFR-13 | Maintainability | Shared types for IR/Manifest across runtime, generator, API, and UI.                                                                  |

## Cross-component dependency contracts

- **Manifest + CurationProfile schemas** ([`data-structure/`](./data-structure/)) — central contracts. Generator produces Manifests using CurationProfiles; Runtime executes Manifests; Registry stores/serves them; UI edits them.
- **Manifest validator** — owned by `@mcp-definer/schemas` (data-structure). Generator, registry, and API call it; they do not own it.
- **Request pipeline** ([`runtime/`](./runtime/) / `packages/request-pipeline`) — shared outbound HTTP + SSRF for runtime tool calls and API `:invoke` (ADR-012).
- **API surface** ([`api-design/`](./api-design/)) — sole HTTP layer; calls registry domain library (ADR-011).
- **Credential binding model** ([`authentication/`](./authentication/)) — referenced by Manifests; MVP: one binding per MCP (ADR-009).
