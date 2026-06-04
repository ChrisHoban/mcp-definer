# MCP Definer



A system that turns any API (plus its specification) into a **standardized MCP (Model Context Protocol) server**, publishes it to a discoverable **registry/index**, and provides a **web UI** for creating, editing, listing, and managing MCPs. Generated MCPs are consumable by harnesses such as Cursor, Claude Desktop, and custom local agents.



---



## What this repository contains



This monorepo contains **design/spec documentation** (component folders at the repo root) and an **implementation skeleton** (`packages/`, `apps/`, `docker/`, `scripts/`) bootstrapped by agent A0. Business logic is added by downstream agents (A1–A9) per [`BUILD_PLAN.md`](./BUILD_PLAN.md).

### Local development (implementation)

```bash
pnpm install
pnpm bootstrap    # install + Postgres (docker) + db:migrate stub
pnpm lint
pnpm test
pnpm build
```

Copy [`.env.example`](./.env.example) to `.env` at the repo root (sets `DATABASE_URL` for migrations/tests). Start Postgres with `docker compose -f docker/docker-compose.yml up -d`, then `pnpm db:migrate`. See [`packages/db/README.md`](./packages/db/README.md) for connection troubleshooting.



## How to use these docs (for human or AI contributors)



1. **Read the top-level docs first** (in this order):

   - [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) — vision, problem framing, glossary.

   - [`REQUIREMENTS.md`](./REQUIREMENTS.md) — system-wide functional & non-functional requirements.

   - [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) — holistic decisions & cross-cutting concerns. **These are binding constraints for every component.**

   - [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — monorepo layout and package boundaries.

   - [`ROADMAP.md`](./ROADMAP.md) — phasing and milestones.

   - [`BUILD_PLAN.md`](./BUILD_PLAN.md) — agent sequencing (A0–A9), hand-off contracts, component splits.

   - [`DEPENDENCIES.md`](./DEPENDENCIES.md) — component × component dependency matrix.

   - [`KICKOFF_BRIEFS.md`](./KICKOFF_BRIEFS.md) — per-agent kickoff briefs.

   - [`TESTING.md`](./TESTING.md) — contract tests, integration, E2E acceptance.

2. **Then read the one component folder you are assigned to.** Each component folder is self-contained.

3. **Honor the contracts.** Where a component depends on another (e.g. the Runtime consumes the Manifest defined by the Generator), the shared contract is documented and must not be changed unilaterally.



## Component map



| Folder | Agent | Package(s) | Responsibility |

|---|---|---|---|

| [`platform/`](./platform/) | A0 | monorepo root | Bootstrap, CI, docker, empty package stubs |

| [`data-structure/`](./data-structure/) | A1 | `packages/schemas`, `packages/db` | Manifest/IR/CurationProfile schema, validator, DB model |

| [`generator/`](./generator/) | A2 | `packages/generator` | Spec → IR → Manifest |

| [`runtime/`](./runtime/) | A3 | `packages/runtime`, `packages/request-pipeline` | Universal MCP server + shared outbound HTTP |

| [`authentication/`](./authentication/) | A4 | `packages/auth` | AuthN/AuthZ, credential bindings, secrets |

| [`registry/`](./registry/) | A5 | `packages/registry` | Publish, catalog, discovery payloads (domain library) |

| [`cli/`](./cli/) | A5 | `packages/cli` | Install, list, validate commands |

| [`api-design/`](./api-design/) | A6 | `packages/api` | **Sole HTTP server** — control plane + discovery |

| [`ui-ux/`](./ui-ux/) | A7/A8 | `apps/web` | Web UI (Phase 3) |



Integration agent **A9** wires everything and runs E2E tests per [`TESTING.md`](./TESTING.md).



## Standard folder contents



Each component folder contains:



- `README.md` — scope, responsibilities, dependencies, and the contracts it owns/consumes.

- `design.md` — detailed design.

- `requirements.md` — functional & non-functional requirements specific to the component.

- `tasks.md` — actionable, ordered task breakdown for implementation.



## Core architectural decisions



- **Manifest-driven runtime** (ADR-001): Generator produces a Manifest; one global `@mcp-definer/runtime` serves any Manifest.

- **Registry is a library, API owns HTTP** (ADR-011): no duplicate HTTP surfaces.

- **Shared request pipeline** (ADR-012): runtime and `:invoke` test console use the same outbound HTTP + SSRF logic.



See [`ARCHITECTURE_DECISIONS.md`](./ARCHITECTURE_DECISIONS.md) for all ADRs.


