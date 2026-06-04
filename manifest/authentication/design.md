# Authentication, Authorization & Secrets — Design

## Part A — Platform AuthN/AuthZ

### Authentication
- **Users:** OAuth2/OIDC (e.g. via an IdP). Sessions for the UI; short-lived access tokens for API.
- **Automation/CLI:** scoped API keys (org-bound, role-limited, revocable).

### Authorization (RBAC) — NFR-05
Roles are stored in **`org_memberships`** (not on `users`). A user may belong to multiple orgs with different roles.
- Roles per org: `owner` > `admin` > `author` > `viewer`.
  - viewer: read catalog/MCPs in scope.
  - author: create/edit drafts, configure auth, test-invoke.
  - admin: publish/deprecate, manage members, manage tags.
  - owner: org settings, billing, signing keys.
- **Resource visibility:** `private` (owner/explicit grants), `org` (all org members), `public` (discoverable by anyone).
- Enforced in the API layer; discovery endpoints honor visibility scoping.

## Part B — Target-API credentials & secrets

### Credential binding model (data-structure: `credential_bindings`)
```jsonc
{
  "id": "cb_123",
  "mcpId": "mcp_abc",
  "authType": "apiKey | bearer | oauth2_cc | oauth2_ac | basic | custom",
  "config": {                  // NON-SECRET metadata only
    "in": "header",            // header | query
    "name": "X-API-Key",       // for apiKey/custom
    "tokenUrl": "https://...", // for oauth2
    "scopes": ["read"],
    "authorizationUrl": "https://..." // for oauth2_ac
  },
  "secretRef": "vault://org/mcp_abc/cb_123"  // pointer; resolved at runtime
}
```
- The Manifest references this via `auth.bindingId` + `auth.apply` (non-secret). See [`data-structure/`](../data-structure/#manifest-schema). **MVP: one binding per MCP** (ADR-009); operation-level OpenAPI security overrides are ignored.

### Secret storage
- **Hosted:** HashiCorp Vault or cloud KMS-backed secret store; encrypted at rest; access-audited.
- **Local:** OS keychain (Windows Credential Manager / macOS Keychain / libsecret) or `.env` for dev.
- Write-only via API: secret values are set, never read back; responses expose only `secretRef` + metadata.

### Just-in-time resolution (used by Runtime)
- The Runtime resolves `secretRef` at tool-call time, keeps the value in memory only, applies it, and never logs it (redaction).

### Supported auth types
| Type | How applied | Notes |
|---|---|---|
| `apiKey` | header or query param | simplest. |
| `bearer` / JWT | `Authorization: Bearer <token>` | static or refreshed. |
| `basic` | `Authorization: Basic <b64>` | user:pass from secret. |
| `custom` | arbitrary header(s) | for non-standard schemes. |
| `oauth2_cc` (client credentials) | fetch token from `tokenUrl`, cache to expiry | machine-to-machine; common. |
| `oauth2_ac` (authorization code) | user-delegated; store refresh token, refresh as needed | **hardest case** — needs an interactive consent flow during setup. |

### OAuth2 auth-code flow (setup-time)
```
UI: start consent → redirect to authorizationUrl → callback with code
  → exchange code for tokens at tokenUrl → store refresh token in vault (secretRef)
Runtime: use refresh token to mint access tokens just-in-time
```

### Per-install credential resolution
- Local installs may bind their **own** secret values (the published Manifest carries no secret), so each operator supplies credentials at install time (CLI prompt) or via local keychain.

## Signing (registry, later — NFR-04)
- Org-scoped signing keys; published Manifests can be signed; consumers verify provenance.

## Threats addressed
- Secret leakage (write-only + redaction + isolation), SSRF (egress allow-list lives in runtime/manifest), token theft (short-lived access tokens, refresh in vault), privilege escalation (RBAC + visibility).
