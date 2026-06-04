# Universal Runtime — Requirements

Refines [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional
- RR-01 Load + validate a Manifest from a local path or Registry reference (FR-16).
- RR-02 Implement MCP protocol: handshake, `tools/list`, `tools/call`, `resources/*`, `prompts/*` (FR-16, NFR-01).
- RR-03 Validate tool-call args against `inputSchema` before any outbound call (FR-16).
- RR-04 Build outbound HTTP request from the tool `request` mapping (FR-16).
- RR-05 Resolve and apply credentials for all supported auth types (FR-06, FR-07).
- RR-06 Shape responses and map errors per Manifest (FR-16).
- RR-07 Serve over stdio and Streamable HTTP/SSE (FR-16, NFR-09).
- RR-08 Enforce timeouts, retries/backoff, rate limiting, circuit-breaking (NFR-06).
- RR-09 Enforce egress allow-list / SSRF protection (NFR-03).

## Non-Functional
- RR-N1 Conformance: identical behavior across compliant harnesses (NFR-01).
- RR-N2 Secrets resolved just-in-time, in-memory only, never logged (NFR-02, ADR-004).
- RR-N3 Low cold-start for stdio; cross-platform Win/macOS/Linux (NFR-09, NFR-12).
- RR-N4 Structured logs + OTel tracing spanning tool-call → API-call, with redaction (NFR-07).

## Acceptance criteria
- A published Manifest loads and is installable/usable in Cursor over stdio.
- Invalid args are rejected without making an outbound call.
- Requests to hosts outside the egress allow-list are blocked.
- No secret value ever appears in logs or traces.
