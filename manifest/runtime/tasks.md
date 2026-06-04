# Universal Runtime — Tasks

Depends on Manifest schema ([`data-structure/`](../data-structure/)) and credential resolution ([`authentication/`](../authentication/)).

## 1. Core server
- [ ] Bootstrap MCP server with official SDK; implement handshake + capability advertisement.
- [ ] Manifest loader + validator (local path + Registry ref).
- [ ] Register tools/resources/prompts dynamically from Manifest.

## 2. Tool-call pipeline
- [ ] Arg validation against `inputSchema` (ajv).
- [ ] **`packages/request-pipeline`:** HTTP build, policies (SSRF, retries), response shaping — export `executeToolCall()` for A6 `:invoke`.
- [ ] Integrate credential resolver from auth package.

## 3. Credentials (integrate authentication component)
- [ ] API key / bearer / basic / custom header application.
- [ ] OAuth2 client-credentials token fetch + cache.
- [ ] OAuth2 auth-code refresh-token handling.
- [ ] Just-in-time secret read; in-memory only; redaction.

## 4. Policies & resilience
- [ ] Timeouts, retries/backoff, circuit-breaker, rate limiting.
- [ ] Egress allow-list enforcement (SSRF protection).

## 5. Transports
- [ ] stdio transport (default).
- [ ] Streamable HTTP/SSE transport + transport-level auth.

## 6. Observability
- [ ] Structured logging with correlation ids.
- [ ] OTel tracing tool-call → outbound call; verify redaction.

## 7. Packaging
- [ ] Cross-platform binary/launch; low cold-start; CLI flags (`--manifest`, `--transport`).

## Definition of done
- Loads a published Manifest and serves it in Cursor over stdio; HTTP transport works; policies + redaction verified; conformance tests pass.
