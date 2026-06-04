# CLI Component

Command-line tools for installing MCPs into local harnesses and (optionally) authoring from the terminal.

## Scope

- **`mcp-definer install <org/slug[@version]> --harness cursor`** — fetch install snippet from registry/API, merge into Cursor `mcp.json`, prompt for credential env vars (ADR-008).
- **`mcp-definer list`** — browse discovery index from terminal (Phase 2).
- **`mcp-definer validate <manifest.json>`** — local manifest validation via `@mcp-definer/schemas` (Phase 1 dev aid).

## Location

`packages/cli` in the monorepo ([`PROJECT_STRUCTURE.md`](../PROJECT_STRUCTURE.md)).

## Agent assignment

Built by **A5 (RG2)** or merged into A5 registry agent. Depends on registry install-snippet builders and API client types.

## Dependencies

- **Consumes:** [`registry/`](../registry/) (`buildInstallSnippet`), [`api-design/`](../api-design/) (discovery fetch), [`authentication/`](../authentication/) (local secret prompt → env var names).

## Files

Implement alongside registry tasks; see [`registry/tasks.md`](../registry/tasks.md) section 5.
