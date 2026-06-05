# Dependency Matrix

How components depend on each other. Pair with [`BUILD_PLAN.md`](./BUILD_PLAN.md).

## Legend

- `H` = hard dependency · `S` = soft (stub OK) · `—` = none

## Component × component matrix

| ↓ depends on →     | platform | data-structure | authentication | generator | runtime | registry | api-design | ui-ux |
| ------------------ | -------- | -------------- | -------------- | --------- | ------- | -------- | ---------- | ----- |
| **platform**       | —        | —              | —              | —         | —       | —        | —          | —     |
| **data-structure** | H        | —              | —              | —         | —       | —        | —          | —     |
| **authentication** | H        | H              | —              | —         | —       | —        | —          | —     |
| **generator**      | H        | H              | —              | —         | —       | —        | —          | —     |
| **runtime**        | H        | H              | H              | —         | —       | S        | —          | —     |
| **registry**       | H        | H              | S              | S         | —       | —        | —          | —     |
| **api-design**     | H        | H              | H              | S         | S       | S        | —          | —     |
| **ui-ux**          | H        | S              | S              | —         | —       | —        | H          | —     |

### Notes

- **platform (A0)** must exist before any implementation agent.
- **runtime** includes **`packages/request-pipeline`** (outbound HTTP + SSRF). API `:invoke` depends on the same pipeline (ADR-012) — shown as runtime → api-design soft edge in orchestration, not a separate row.
- **registry** calls `@mcp-definer/schemas` validator (**owned by data-structure**, not generator).
- **api-design** is the **only HTTP layer** (ADR-011); it calls registry as a library.

## Owned contracts

| Contract                                          | Owner                                       | Consumers                             |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------------- |
| Monorepo layout                                   | platform (A0)                               | all                                   |
| IR + Manifest + CurationProfile schemas           | data-structure                              | generator, runtime, registry, api, ui |
| **`validateManifest()` implementation**           | **data-structure (`@mcp-definer/schemas`)** | generator, registry, api              |
| Relational data model                             | data-structure                              | auth, registry, api                   |
| **`request-pipeline` (outbound HTTP + policies)** | runtime (A3)                                | runtime, api (`:invoke`)              |
| Credential resolver interface                     | authentication                              | runtime, request-pipeline             |
| RBAC + visibility (`org_memberships`)             | authentication                              | api, ui                               |
| Discovery index v1 + install snippet builders     | registry                                    | api, cli, runtime                     |
| HTTP API contract (OpenAPI)                       | api-design                                  | ui, cli                               |
| Cursor install format                             | registry (via ADR-008)                      | cli                                   |

## Change blast-radius

| If you change…                    | Re-verify…                                               |
| --------------------------------- | -------------------------------------------------------- |
| Manifest / CurationProfile schema | generator, runtime, registry, api, ui — **ADR required** |
| `validateManifest()`              | generator, registry publish, api `:validate`             |
| `request-pipeline`                | runtime tool calls **and** api `:invoke`                 |
| Credential resolver               | runtime, request-pipeline, `:invoke`                     |
| Discovery index v1                | api routes, cli, fixtures                                |
| `org_memberships` model           | auth, api authz, ui role gating                          |

## Build order

```
A0 → A1 → {A2, A3, A4} → {A5, A6} → {A7, A8} → A9
```
