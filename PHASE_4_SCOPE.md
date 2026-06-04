# Phase 4 Scope

Explicit backlog deferred from Phases 1–3. Do not block MVP/registry/UI delivery on these items.

## P4-1 — Real authentication and multi-tenancy

- OAuth2/OIDC for human users; sessions and short-lived API tokens
- Scoped, revocable API keys for CLI/automation
- Load roles from `org_memberships`; reject control-plane actions when JWT/API key role lacks permission
- Multiple organizations with isolated catalogs; no single `DEFAULT_USER_ID` stub in production

**Requirements:** AUTH-01–03, FR-20, NFR-05

## P4-2 — Meta-tools (tool explosion)

- Implement `metaToolsEnabled` in curation: emit `search_tools` and `invoke_operation` tools
- Runtime support for meta-tool dispatch
- UX guidance for large OpenAPI specs (300+ operations)

**Requirements:** GR-07, ADR-003

## P4-3 — HTTP transport, vault, signing, observability

- Universal Runtime Streamable HTTP/SSE; transport-level auth
- Install snippets and `install_targets` for `http` transport
- Vault/KMS and OS keychain `secretRef` schemes (env remains supported)
- Sign published manifests; consumer verification helpers
- OpenTelemetry spans; circuit-breaker and rate limits on outbound calls
- OAuth2 authorization-code flow end-to-end

**Requirements:** FR-06 (oauth2_ac), FR-15–16, FR-19, NFR-02–07

## Out of phase 4

- GraphQL/gRPC/AsyncAPI parsers → Phase 5
- Async generation worker queue → Phase 5 / platform scaling
