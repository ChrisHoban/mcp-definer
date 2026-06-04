# Universal Runtime — Design

## Startup
```
launch (stdio or http) with --manifest <path|registry-ref>
  → load + validate Manifest (shared validator)
  → resolve credential binding handle (defer secret read to call time)
  → register tools/resources/prompts with MCP SDK
  → begin serving on the chosen transport
```

## Tool-call request pipeline
```
tools/call(name, args)
  → [1] validate args against tool.inputSchema (ajv)
  → [2] build HTTP request from tool.request (method, pathTemplate, paramMap, bodyParam)
  → [3] resolve + apply credentials (auth.bindingId → secret → header/query/oauth)
  → [4] enforce policies via **request-pipeline** (egress allowlist, timeout, retries, rate limit)
  → [5] execute outbound HTTP call (request-pipeline)
  → [6] shape response (passthrough | summarize | jsonpath) + map errors
  → [7] return MCP tool result; emit trace/log (redacted)
```

### [1] Arg validation
- Reject calls failing `inputSchema` with a structured MCP error (no outbound call made).

### [2] Request building
- Substitute `path` params into `pathTemplate`; attach `query`/`header` params per `paramMap`; serialize `bodyParam` with declared content type.

### [3] Credential resolution (delegates to authentication component)
- API key/bearer/basic/custom: read secret from vault/keychain, apply per `auth.apply`.
- OAuth2 client-credentials: fetch/cache token (respect expiry), attach bearer.
- OAuth2 auth-code (user-delegated): use stored refresh token; refresh as needed. (Hardest case — see [`authentication/`](../authentication/).)
- Secrets are read just-in-time, kept in memory only, never logged.

### [4] Policies (NFR-03, NFR-06)
- **Egress allow-list** from `manifest.policies.egressAllowlist` → block requests to other hosts (SSRF protection).
- **Timeouts**, **retries with backoff**, optional **circuit-breaking**, **rate limiting**.

### [6] Response shaping
- `passthrough` default; `summarize` for oversized payloads; `jsonpath` to extract. Map non-success statuses to MCP errors or returned payloads per `response.errorMap`.

## Transports
- **stdio** — default for local harnesses (Cursor). Fast cold-start (NFR-12).
- **Streamable HTTP / SSE** — for hosted/remote operation; supports auth on the transport itself.
- Transport selected at launch; both speak identical MCP semantics.

## Observability (NFR-07)
- Structured logs with correlation ids; OpenTelemetry span from `tools/call` → outbound API call.
- **Redaction**: secrets and sensitive headers never appear in logs/traces.

## Operational modes
- **Local**: runs on the user's machine; secrets from OS keychain/env; control plane not in the request path (ADR-005).
- **Hosted**: runs server-side; secrets from vault; transport-level auth required.

## Failure handling
- Distinguish: validation errors (4xx-like, no call), upstream errors (mapped), runtime/policy errors (timeout, blocked egress). Return clear MCP errors so agents can react.
