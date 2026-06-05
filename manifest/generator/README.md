# Generator Component

Ingests an API spec, normalizes it into the **IR**, and compiles a standardized **Manifest** (operation→tool mapping). The Generator is where spec-format complexity is absorbed.

## Responsibilities

- **Spec ingestion**: accept upload / URL / pasted text; detect format.
- **Parsing & normalization**: validate, dereference `$ref`s, resolve components → IR.
- **Mapping engine**: IR operations → MCP tools (names, input schemas, request mapping, response shaping); optional resources/prompts.
- **Curation application**: apply author overrides (include/exclude, rename, regroup, edit descriptions).
- **Tool-explosion mitigation**: filtering, grouping, optional search/select meta-tools.
- **Validation**: conformance + JSON Schema checks before a Manifest can be published.
- **Regeneration & diff**: re-run on spec drift, produce reviewable diff.

## Dependencies

- **Consumes:** [`data-structure/`](../data-structure/) IR + Manifest schemas.
- **Consumed by:** [`api-design/`](../api-design/) (`/specs:parse`, version create, `:validate`, `:regenerate`), [`ui-ux/`](../ui-ux/) (preview/curation), [`registry/`](../registry/) (publishes the produced Manifest).

## Files

- [`design.md`](./design.md) — mapping rules and pipeline.
- [`requirements.md`](./requirements.md)
- [`tasks.md`](./tasks.md)

## Key constraints

- **Deterministic** (NFR-06): same input + curation → identical Manifest.
- Produces **no secrets**; only `auth.bindingId` + apply-metadata (ADR-004).
- Default primitive is **tool** per operation (ADR-003).
