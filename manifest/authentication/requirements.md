# Authentication, Authorization & Secrets — Requirements

Refines [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional

- AUTH-01 Authenticate users via OAuth2/OIDC; issue sessions + short-lived API tokens (NFR-05).
- AUTH-02 Issue scoped, revocable API keys for CLI/automation.
- AUTH-03 Enforce org-scoped RBAC (owner/admin/author/viewer) across control-plane actions (NFR-05).
- AUTH-04 Enforce resource visibility (private/org/public) including on discovery (FR-20, NFR-05).
- AUTH-05 Manage credential bindings (non-secret metadata) per MCP (FR-06).
- AUTH-06 Store secrets in vault (hosted) / keychain (local); write-only via API (FR-07, ADR-004).
- AUTH-07 Resolve secrets just-in-time for the Runtime; in-memory only; redacted in logs (FR-07).
- AUTH-08 Support apiKey, bearer/JWT, basic, custom, oauth2_cc, oauth2_ac (FR-06).
- AUTH-09 Provide OAuth2 auth-code consent flow at setup; store + refresh tokens.
- AUTH-10 (Later) Manage org signing keys; sign published artifacts (NFR-04).

## Non-Functional

- AUTH-N1 No secret value is ever returned by an API or written to a Manifest/log (NFR-02, ADR-004).
- AUTH-N2 Secrets encrypted at rest; access audited (NFR-02, NFR-07).
- AUTH-N3 Least-privilege credentials; tokens short-lived (NFR-02).
- AUTH-N4 Per-install credential binding so shared Manifests carry no secrets.

## Acceptance criteria

- A binding can be created with a secret value, and no subsequent read exposes it.
- RBAC blocks an `author` from publishing; allows an `admin`.
- The Runtime authenticates a real apiKey and oauth2_cc API call using resolved secrets without logging them.
- Discovery hides `private` MCPs from unauthorized callers.
