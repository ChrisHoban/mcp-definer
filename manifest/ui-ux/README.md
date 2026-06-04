# UI / UX Component

The web application for **creating, editing, listing, and managing** MCPs, including an **in-UI test console**. It is the primary human surface; the registry/discovery side is consumed by harnesses programmatically.

## Responsibilities
- **Create flow**: import spec → preview discovered operations → curate tools → configure auth → validate → save draft → publish.
- **Manage**: searchable list of MCPs with status/version, edit, clone, deprecate, archive, version history.
- **Test console**: invoke a tool against the live target API before publishing.
- **Credential UX**: capture secrets via write-only forms tied to credential bindings.
- **Install helper**: surface harness install snippets/instructions.

## Dependencies
- **Consumes:** [`api-design/`](../api-design/) (all data + actions), [`authentication/`](../authentication/) (login, RBAC-aware UI, credential forms), [`data-structure/`](../data-structure/) (Manifest/tool shapes for editing).
- **Consumed by:** human users.

## Files
- [`design.md`](./design.md) — screens, flows, component choices.
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)

## UX north star (NFR-10)
Tool **names and descriptions are LLM-facing** and directly affect agent tool-selection accuracy. The UI must actively guide authors toward high-quality, descriptive metadata (inline guidance, warnings on empty/poor descriptions, previews of how an agent "sees" the tool).

## Stack (per ADR-002)
React + TypeScript + Vite; component lib (shadcn/ui or MUI); forms via React Hook Form + Zod; data via TanStack Query; a **JSON-Schema-driven form renderer** (tool inputs are JSON Schemas).
