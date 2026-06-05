# @mcp-definer/auth

Platform RBAC (via `org_memberships`) and target-API credential resolution for MCP Definer.

## RBAC

Roles are **per-org** in `org_memberships` — not on `users.role`:

| Role     | Capabilities                                    |
| -------- | ----------------------------------------------- |
| `viewer` | Read catalog/MCPs in scope                      |
| `author` | Create/edit drafts, configure auth, test-invoke |
| `admin`  | Publish/deprecate, manage members, manage tags  |
| `owner`  | Org settings, billing, signing keys             |

Use `hasPermission(role, permission)` and `canViewMcp(membership, mcp)` in the API layer (A6).

## Credential bindings

Bindings store **non-secret** `config` + a `secretRef` pointer. Secret values are never returned by the public binding API (`CredentialBindingPublic`).

- **Postgres registry:** metadata persisted in `credential_bindings`; `secretRef` is always `env:MCP_DEFINER_SECRET_{bindingId}` (ADR-013).
- **In-memory registry (tests):** same env convention; metadata in `InMemoryBindingStore`.

MVP: **one binding per MCP** (ADR-009).

## Local secret env convention (ADR-008)

Per-install secrets are supplied via environment variables:

```
MCP_DEFINER_SECRET_{bindingId}
```

Examples:

| bindingId            | Env var                                 |
| -------------------- | --------------------------------------- |
| `cb_petstore_apikey` | `MCP_DEFINER_SECRET_cb_petstore_apikey` |
| `cb_123`             | `MCP_DEFINER_SECRET_cb_123`             |

Cursor install snippet:

```jsonc
{
  "mcpServers": {
    "petstore": {
      "command": "npx",
      "args": [
        "-y",
        "@mcp-definer/runtime",
        "--manifest",
        "https://registry.example.com/.../manifest",
      ],
      "env": {
        "MCP_DEFINER_SECRET_cb_petstore_apikey": "<user-supplied at install>",
      },
    },
  },
}
```

Use `secretEnvVarName(bindingId)` when generating install snippets.

## Secret formats (runtime resolution)

| authType    | Secret value format                                                  |
| ----------- | -------------------------------------------------------------------- |
| `apiKey`    | Plain string                                                         |
| `bearer`    | Plain token string                                                   |
| `basic`     | `user:pass` or `{"username":"...","password":"..."}`                 |
| `custom`    | JSON object of header name → value                                   |
| `oauth2_cc` | `clientId:clientSecret` or `{"clientId":"...","clientSecret":"..."}` |

## Write-only secrets

`SecretStore` exposes `setSecret`, `hasSecret`, and `deleteSecret` only — **no read-back**. The runtime resolver reads secrets internally at call time.

## CredentialResolver

```typescript
interface CredentialResolver {
  resolve(bindingId: string): Promise<ResolvedCredential>;
  apply(credential: ResolvedCredential, request: HttpRequest): HttpRequest;
}
```

`EnvCredentialResolver` reads secrets from `MCP_DEFINER_SECRET_*` env vars (and optional process overlay when the API accepts a one-time secret on create). Phase 4 adds vault/keychain `secretRef` schemes — see [`PHASE_4_SCOPE.md`](../../manifest/PHASE_4_SCOPE.md).
