# UI / UX — Requirements

Refines [`../REQUIREMENTS.md`](../REQUIREMENTS.md).

## Functional

- UR-01 Import spec via upload/URL/paste with clear parse-error feedback (FR-01).
- UR-02 Preview discovered operations with bulk include/exclude, search/filter for large specs (FR-05).
- UR-03 Curate tools: edit name, description, group, input schema, response shaping (FR-05).
- UR-04 Configure auth with write-only secret entry; launch OAuth2 consent where needed (FR-06, FR-07).
- UR-05 Validate with inline error/warning display; block publish until clean (FR-08).
- UR-06 Test console: schema-driven form → invoke → show request/response/status/timing (FR-09).
- UR-07 Publish flow: semver + channel + changelog; communicate immutability (FR-10, FR-11).
- UR-08 Manage list: search/filter/sort; row actions (edit/clone/new version/deprecate/archive) (FR-12, FR-13).
- UR-09 MCP detail: version history, capabilities, audit, install instructions (FR-18, FR-15).
- UR-10 Regeneration diff view → create new draft (FR-17).
- UR-11 Registry browse + install panel (harness/transport/snippet/CLI) (FR-14, FR-15).
- UR-12 RBAC-aware rendering of actions; visibility scoping (FR-20, NFR-05).

## Non-Functional

- UR-N1 Guide authors to high-quality LLM-facing tool metadata; "how the agent sees this" preview (NFR-10).
- UR-N2 Never display secret values; masked/“set” indicators only (NFR-02).
- UR-N3 Accessible (keyboard/ARIA), responsive; complete loading/empty/error states.
- UR-N4 Cache-aware data fetching; resilient to API errors with actionable messages.

## Acceptance criteria

- A user completes spec→curate→auth→validate→publish without leaving the UI.
- Publishing a 300-operation spec is manageable via filtering/grouping.
- No screen ever renders a secret value.
- Validation errors from the API are shown inline and block publish.
