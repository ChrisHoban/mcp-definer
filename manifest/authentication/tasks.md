# Authentication, Authorization & Secrets — Tasks

Depends on [`data-structure/`](../data-structure/) (users/orgs/credential_bindings).

## 1. Platform AuthN
- [ ] Integrate OAuth2/OIDC login; sessions + short-lived API tokens.
- [ ] Scoped, revocable API keys for CLI/automation.

## 2. AuthZ / RBAC
- [ ] Define roles + permission matrix (owner/admin/author/viewer).
- [ ] Authz middleware for control-plane actions.
- [ ] Visibility scoping (private/org/public) applied to reads incl. discovery.

## 3. Credential bindings
- [ ] CRUD for bindings (non-secret metadata).
- [ ] Write-only secret intake; ensure no read-back path.

## 4. Secret storage
- [ ] Hosted: vault/KMS integration (encrypted at rest, access-audited).
- [ ] Local: OS keychain adapters (Windows/macOS/Linux) + dev `.env`.
- [ ] `secretRef` scheme + resolver interface (consumed by Runtime).

## 5. Auth type handlers
- [ ] apiKey / bearer / basic / custom application.
- [ ] OAuth2 client-credentials: token fetch + cache.
- [ ] OAuth2 auth-code: consent flow at setup + refresh-token storage/refresh.

## 6. Resolution & redaction
- [ ] Just-in-time resolver for Runtime; in-memory only.
- [ ] Log/trace redaction filter verified.

## 7. Signing (later)
- [ ] Org signing keys; sign published Manifests; verification helper.

## Definition of done
- Login + API keys + RBAC + visibility enforced; bindings store secrets write-only; Runtime resolves + applies secrets for all auth types without leakage; auth-code consent flow works.
