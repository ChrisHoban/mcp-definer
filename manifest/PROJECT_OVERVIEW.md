# Project Overview

## Vision

Make it trivial to expose any HTTP API to AI agents in a **standardized, interoperable** way. A user supplies an API and its specification; the system produces a conformant MCP server, publishes it to a shared registry, and lets any MCP-compatible harness (Cursor, Claude Desktop, custom agents) discover and install it.

## The problem

- Connecting an LLM agent to a real API today is bespoke, repetitive, and error-prone.
- The Model Context Protocol (MCP) standardizes how agents consume tools/resources, but **authoring** MCP servers is still manual.
- There is no easy on-ramp from an existing API spec (OpenAPI/Swagger) to a working, standardized MCP.
- There is no consistent, curated **index** for agents/harnesses to discover available MCPs.

## What we are building

Three cooperating sub-systems:

1. **Generator** — ingests an API + spec, normalizes it, and emits a standardized **Manifest** (operation→tool mapping, auth bindings, transport config).
2. **Registry/Index** — a versioned catalog where Manifests are published, discovered, and installed by harnesses.
3. **Management UI** — web forms to create/modify MCPs and to list/manage the catalog, including an in-UI test console.

Plus the **Universal Runtime** that actually serves a Manifest as a live MCP server, and an optional **Code Generator** ("eject") for standalone server projects.

## Primary users / personas

- **MCP Author** — wraps an API they own or consume; curates tools, sets auth, publishes.
- **Agent/Harness Operator** — browses the registry, installs MCPs into Cursor or another harness.
- **Platform Admin** — manages tenancy, governance, who can publish, and trust/signing.
- **Downstream Agent (non-human)** — programmatically queries the discovery index and loads Manifests.

## Success criteria

- An OpenAPI 3 spec can become an installed, working MCP in Cursor in minutes, with no hand-written code.
- Generated MCPs are spec-conformant and behave identically across compliant harnesses.
- The registry is the single source of discovery for available MCPs in an org.

## Glossary

| Term                   | Meaning                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **MCP**                | Model Context Protocol — the standard by which agents consume tools, resources, and prompts from servers.                            |
| **Harness**            | An MCP client/host (e.g. Cursor, Claude Desktop, a custom agent runtime).                                                            |
| **Tool**               | An MCP-exposed callable with a JSON Schema input; here, derived from an API operation.                                               |
| **Resource**           | An MCP-exposed readable data item (often read-only API data).                                                                        |
| **Manifest**           | The declarative, versioned source-of-truth document describing an MCP (tools, auth, transport, target API). Consumed by the Runtime. |
| **IR**                 | Intermediate Representation — normalized form of a parsed API spec, before Manifest compilation.                                     |
| **Universal Runtime**  | A single program that loads any Manifest and serves it as an MCP server.                                                             |
| **Registry / Index**   | The catalog service that stores, versions, and exposes MCPs for discovery and install.                                               |
| **Credential Binding** | Non-secret metadata describing how an MCP authenticates to its target API; references a secret, never stores it.                     |
| **Eject / Codegen**    | Optional export of a Manifest into a standalone runnable MCP server project.                                                         |

## Out of scope (initially)

- Non-HTTP protocols beyond REST (GraphQL, gRPC, AsyncAPI) — deferred to a later phase.
- Hosting/operating the target APIs themselves.
- Building harnesses; we integrate with existing ones.
