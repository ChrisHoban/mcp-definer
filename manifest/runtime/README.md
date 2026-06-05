# Universal Runtime Component

A single program that loads any **Manifest** and serves it as a live, spec-conformant **MCP server**. This is the heart of the manifest-driven architecture (ADR-001) and a critical dependency (must be robust, secure, observable).

## Responsibilities

- Implement the MCP server protocol: handshake, `tools/list`, `tools/call`, `resources/*`, `prompts/*`.
- Load a Manifest (from a local file or the Registry) and dynamically advertise its tools/resources/prompts.
- On a tool call: validate args → build the HTTP request (per `request` mapping) → resolve credentials (binding) → call the target API → shape the response.
- Support transports: **stdio** (local, Cursor default) and **Streamable HTTP/SSE** (remote/hosted).
- Enforce cross-cutting policies: timeouts, retries, rate limiting, egress allow-listing (SSRF), logging/redaction, tracing.

## Dependencies

- **Consumes:** [`data-structure/`](../data-structure/) Manifest schema; [`authentication/`](../authentication/) for credential resolution; [`request-pipeline`](../PROJECT_STRUCTURE.md) for outbound HTTP; optionally registry for manifest fetch by URL.
- **Consumed by:** harnesses (Cursor, Claude Desktop, custom agents) as an MCP server.

## Files

- [`design.md`](./design.md) — protocol handling, request pipeline, transports, policies.
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)

## Key constraints

- **Conformance first** (NFR-01): behavior identical across compliant harnesses.
- Secrets resolved at call time from the vault/keychain; never logged (ADR-004, NFR-02).
- Low cold-start for local stdio (NFR-12); cross-platform (NFR-09).
- Uses the official MCP SDK (`@modelcontextprotocol/sdk`).
