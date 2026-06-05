# API Design Component

Defines the **HTTP API surface** for the system: a **Control Plane** API (authoring & management, authenticated) and a **Discovery** API (consumption by harnesses, mostly public/read-only).

**Per ADR-011, this component owns all HTTP.** Registry is a domain library this layer calls — it does not expose its own server.

## Responsibilities

- Specify endpoints, verbs, request/response shapes, status codes, and conventions.
- Orchestrate the Generator, Registry, and Auth components behind clean REST resources.
- Enforce authz, pagination, versioning, and the immutability boundary at the API layer.

## Dependencies

- **Consumes:** [`generator/`](../generator/) (parse/validate/regenerate), [`registry/`](../registry/) (publish/discover/install), [`data-structure/`](../data-structure/) (entities), [`authentication/`](../authentication/) (authn/authz).
- **Consumed by:** [`ui-ux/`](../ui-ux/), the install CLI, and external harnesses (discovery endpoints).

## Files

- [`design.md`](./design.md) — full endpoint catalog + conventions.
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)

## Key conventions (summary)

- URL-versioned (`/v1`); resource versions are semver in path.
- Action endpoints use `:verb` (`:publish`, `:validate`, `:invoke`, `:regenerate`).
- Drafts mutable via `PATCH`; published versions immutable → `409`.
- Cursor-based pagination; ETags on discovery reads.
- Secrets are **write-only** fields; GETs return only binding metadata / `secret_ref`.
