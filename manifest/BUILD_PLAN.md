# Build Plan — Agent Sequencing & Decomposition

How to build this system with **independent, single-context agents**, in the right order, with the right hand-off contracts.

> See also: [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) · [`DEPENDENCIES.md`](./DEPENDENCIES.md) · [`KICKOFF_BRIEFS.md`](./KICKOFF_BRIEFS.md) · [`TESTING.md`](./TESTING.md)

---

## Guiding principle: contract-first, then parallelize

Once a contract is **frozen and published as typed stubs/fixtures**, downstream agents build against it in parallel. **Freeze, don't finish.**

---

## Baseline roster — 10 agents in 5 waves

```
WAVE -1 (first)     WAVE 0 (blocking)      WAVE 1 (parallel)        WAVE 2 (parallel)     WAVE 3 (parallel)      WAVE 4
┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐     ┌────────────────┐    ┌───────────────────┐   ┌─────────────┐
│ A0 platform  │ ─► │ A1 data-struct  │ ─► │ A2 generator     │ ──┐ │ A5 registry    │ ──┐│ A7 ui (author)    │   │ A9 integr.  │
│ bootstrap    │    │ schemas+db+     │    │ A3 runtime       │   ├►│ A6 api-design  │   ├►│ A8 ui (manage+    │──►│ E2E+contract│
│ monorepo+CI  │    │ validator       │    │ A4 authentication│ ──┘ └────────────────┘   │ │    test+browse)   │   │ tests       │
└──────────────┘    └─────────────────┘    └──────────────────┘                          └─└───────────────────┘   └─────────────┘
```

| Agent  | Component                      | Depends on (hard) | Builds against (stub OK)          | Parallel with         |
| ------ | ------------------------------ | ----------------- | --------------------------------- | --------------------- |
| **A0** | `platform`                     | —                 | —                                 | (none — runs first)   |
| **A1** | `data-structure`               | A0 monorepo       | —                                 | — (after A0)          |
| **A2** | `generator`                    | A0, A1 schema     | —                                 | A3, A4                |
| **A3** | `runtime` + `request-pipeline` | A0, A1 schema     | A4 resolver stub                  | A2, A4                |
| **A4** | `authentication`               | A0, A1 model      | —                                 | A2, A3                |
| **A5** | `registry` + `cli`             | A0, A1            | A1 validator (real)               | A6                    |
| **A6** | `api-design`                   | A0, A1            | A2/A4/A5/request-pipeline (stubs) | A5                    |
| **A7** | `ui-ux` authoring              | A6 contract       | A6 mock API                       | A8                    |
| **A8** | `ui-ux` management             | A6 contract       | A6 mock API                       | A7                    |
| **A9** | integration / E2E              | A2–A8             | —                                 | (after core complete) |

**Lean (7 agents):** A0 · A1 · (generator+runtime) · authentication · (registry+api+cli) · (ui combined) · A9.

**Recommended (10 agents):** table above.

**Max parallel (~14):** A0 · A1a schemas · A1b db · G1 · G2 · R1 · R2 · AU1 · AU2 · RG1 · RG2 · AP1 · AP2 · A7 · A8 · A9.

---

## Critical path

```
A0 → A1 (schemas frozen early) → max(A2, A3) → A6 → A7/A8 → A9
```

A4, A5 overlap with A2/A3/A6. **A9 is mandatory**, not optional.

---

## Interface freeze points

| Freezes                                                                         | Owner  | Consumers            | Deliverable                                         |
| ------------------------------------------------------------------------------- | ------ | -------------------- | --------------------------------------------------- |
| Monorepo skeleton + CI                                                          | A0     | all                  | `pnpm bootstrap` works                              |
| IR + Manifest + CurationProfile schemas, TS types, **validator impl**, fixtures | **A1** | A2, A3, A5, A6       | `@mcp-definer/schemas` package                      |
| Credential resolver interface                                                   | A4     | A3, request-pipeline | Interface + in-memory stub                          |
| `request-pipeline` execute API                                                  | A3     | A6 (`:invoke`)       | `executeToolCall(manifest, tool, args, credential)` |
| Discovery index v1 shape + install snippet builder                              | A5     | A6, CLI, runtime     | `fixtures/registry/index-v1.json`                   |
| HTTP API contract + mock server                                                 | A6     | A7, A8               | OpenAPI doc + mock                                  |

**Validator ownership (resolved):** A1 **owns** `validateManifest()` in `@mcp-definer/schemas`. A2, A5, A6 **call** it — they do not define or stub their own.

---

## Registry vs API (ADR-011)

- **A5 (`packages/registry`):** domain logic only — publish, catalog, discovery payload builders, install snippets. **No HTTP.**
- **A6 (`packages/api`):** sole HTTP server — routes call registry/generator/runtime/auth.
- **CLI (`packages/cli`):** same agent as A5 (or RG2 sub-agent).

---

## Recommended breakdowns (oversized components)

### A1 → 2 sub-agents (if needed)

- **A1a:** schemas, types, validator, fixtures → `packages/schemas`
- **A1b:** DDL, migrations, discovery view → `packages/db`

### `generator` → G1 + G2 (+ optional G3)

Split across IR contract. See prior breakdown.

### `runtime` → R1 + R2

R1: MCP server + tool pipeline. R2: transports, policies, observability. **R1 also owns `packages/request-pipeline`** (shared with `:invoke`).

### `authentication` → AU1 + AU2

AU1: OIDC, API keys, RBAC. AU2: secrets, resolver, OAuth cc (**defer OAuth ac to Phase 3**).

### `registry` → RG1 + RG2

RG2 includes CLI.

---

## Phase alignment (see [`ROADMAP.md`](./ROADMAP.md))

| Product phase           | Agent waves            | Deliverable                                                        |
| ----------------------- | ---------------------- | ------------------------------------------------------------------ |
| Phase 1 MVP             | A0 → A1 → A2 + A3 + A4 | CLI/spec → manifest → runtime in Cursor (manual or `cli validate`) |
| Phase 2 Registry        | A5 + A6                | Publish, discover, `cli install`                                   |
| Phase 3 Authoring depth | A7 + A8                | Full UI wizard, test console, curation                             |
| Phase 4+                | Hardening agents       | OAuth ac, HTTP transport, signing                                  |

Phase 1 intentionally **does not require UI** — CLI + runtime prove the core loop before A7/A8.

---

## Per-agent task pointers

[`platform/tasks.md`](./platform/tasks.md) · [`data-structure/tasks.md`](./data-structure/tasks.md) · [`generator/tasks.md`](./generator/tasks.md) · [`runtime/tasks.md`](./runtime/tasks.md) · [`authentication/tasks.md`](./authentication/tasks.md) · [`registry/tasks.md`](./registry/tasks.md) · [`api-design/tasks.md`](./api-design/tasks.md) · [`ui-ux/tasks.md`](./ui-ux/tasks.md)

## Definition of done (A9 verifies)

End-to-end loop per [`TESTING.md`](./TESTING.md#e2e-acceptance-a9--definition-of-done).
