# UI / UX — Tasks

Depends on [`api-design/`](../api-design/) endpoints and [`authentication/`](../authentication/) for login/RBAC.

## 1. App shell & infra

- [ ] Scaffold React + TS + Vite; component lib; routing; TanStack Query; auth/session wiring.
- [ ] JSON-Schema-driven form renderer (used for inputSchema + test console).

## 2. Create / edit wizard

- [ ] Import step (upload/URL/paste → `:parse`) with error display.
- [ ] Operation preview (bulk include/exclude, search/filter for large specs).
- [ ] Tool curation (name/description/group/schema/response shaping) + metadata-quality guidance.
- [ ] Auth config step (types + write-only secrets + OAuth2 consent launch).
- [ ] Validate step (inline errors/warnings; gate publish).
- [ ] Publish step (semver/channel/changelog; immutability messaging).

## 3. Manage & detail

- [ ] MCP list (search/filter/sort + row actions).
- [ ] MCP detail (version history, capabilities, audit, install instructions).
- [ ] Regeneration diff view → new draft.

## 4. Test console

- [ ] Tool picker → schema form → `:invoke` → request/response/status/timing display (secret-safe).

## 5. Registry / discovery surface

- [ ] Browse view + install panel (harness/transport/snippet/CLI).

## 6. Cross-cutting

- [ ] RBAC-aware action gating + visibility.
- [ ] "How the agent sees this" preview.
- [ ] Accessibility, responsive layout, loading/empty/error states.
- [ ] Verify no secret values are ever rendered.

## Definition of done

- End-to-end authoring flow works against the API; large specs are manageable; test console functions; RBAC + secret-safety verified.
