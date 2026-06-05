# UI / UX — Design

## Information architecture

```
/ (catalog: my org's MCPs)
/mcps/new                      → create wizard
/mcps/:id                      → MCP detail (overview, versions, settings)
/mcps/:id/versions/:ver/edit   → version editor (tool curation, auth, validate)
/mcps/:id/test                 → test console
/registry                      → browse/discover (incl. public)
/settings (org, members, credentials, signing keys)
```

## Create / edit wizard (the core flow — FR-01–FR-10)

Stepper, each step maps to API actions:

1. **Import spec** — upload / URL / paste. Calls `POST /v1/specs:parse`. Show parse errors clearly.
2. **Preview operations** — table of discovered operations (method, path, tag, summary). Bulk include/exclude; search/filter (handles large APIs).
3. **Curate tools** — per tool: edit name, **description** (with quality guidance — NFR-10), group, edit/tighten input schema via the JSON-Schema form renderer, response shaping. Surface tool-explosion mitigations (filter/group/meta-tools) for large specs.
4. **Configure auth** — pick auth type; fill non-secret config; enter secret via **write-only** field (→ credential binding). OAuth2 auth-code launches the consent flow.
5. **Validate** — `:validate`; render errors/warnings inline, blocking publish until clean.
6. **Test** (optional) — jump to test console.
7. **Publish** — choose version (semver) + channel; show changelog field; confirm immutability.

## Manage / list (FR-12, FR-13, FR-18)

- Searchable, filterable table: name, description, status (draft/published/deprecated), latest version, channel, visibility, tags.
- Row actions: edit, clone, new version, deprecate, archive.
- MCP detail: version history timeline, capabilities (tools), audit events, install instructions.

## Test console (FR-09)

- Pick a tool → auto-generate a form from its `inputSchema` (JSON-Schema renderer) → submit → `POST .../tools/{tool}:invoke` → show request, response, status, timing. Uses a bound credential; never displays secret values.

## Regeneration / spec drift (FR-17)

- "Update spec" action → `:regenerate` → render a **diff view** (added/removed/changed tools + schema changes) → author accepts → creates a new draft version.

## Discovery / install surface (FR-14, FR-15)

- Registry browse view (cards/table) with capabilities summary.
- Per-MCP install panel: harness selector (Cursor/Claude/generic), transport, copyable config snippet, and CLI command.

## RBAC-aware UI (NFR-05)

- Hide/disable actions by role: viewers read-only; authors edit drafts/test; admins publish/deprecate; owners manage org/keys. Reflect visibility scoping.

## Cross-cutting UX

- Inline validation + structured error display from the API.
- Optimistic, cache-aware data fetching (TanStack Query).
- Accessibility (keyboard, ARIA) and responsive layout.
- Empty/loading/error states for every async surface.
- Never render secret values; show only masked/“set” indicators.

## "How the agent sees this" preview (NFR-10)

A panel that renders the tool list exactly as a harness/LLM would receive it (names + descriptions + input schema), so authors optimize for agent comprehension.
