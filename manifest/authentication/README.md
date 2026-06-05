# Authentication, Authorization & Secrets Component

Covers **two distinct concerns** that share this folder:

1. **Platform AuthN/AuthZ** — who can use the system (users, orgs, RBAC) and access control on control-plane/discovery APIs.
2. **Target-API credentials & secrets** — how a generated MCP authenticates to _its_ upstream API, via **credential bindings** that reference secrets stored in a vault/keychain (never in Manifests).

## Responsibilities

- User authentication (OAuth2/OIDC) + API keys for CLI/automation.
- RBAC: org-scoped roles (owner/admin/author/viewer); resource visibility (private/org/public).
- Credential binding model: non-secret metadata describing how to auth to a target API.
- Secrets storage + just-in-time resolution (vault hosted; OS keychain/env local).
- Support auth types: API key, bearer/JWT, OAuth2 client-credentials, OAuth2 auth-code (user-delegated), basic, custom header.
- Optional signing keys for artifact signing (registry).

## Dependencies

- **Consumes:** [`data-structure/`](../data-structure/) (users, orgs, credential_bindings shape).
- **Consumed by:** [`api-design/`](../api-design/) (authn/authz middleware, binding endpoints), [`runtime/`](../runtime/) (credential resolution at call time), [`registry/`](../registry/) (publish authz, signing), [`ui-ux/`](../ui-ux/) (login, credential forms).

## Files

- [`design.md`](./design.md)
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)

## Non-negotiable principle

**Secrets never live in Manifests, registry artifacts, API responses, or logs** (ADR-004, NFR-02). Manifests carry only a `bindingId` + non-secret apply-metadata; secret values are read just-in-time and held in memory only.
