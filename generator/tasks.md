# Generator — Tasks

Depends on the Manifest/IR schema from [`data-structure/`](../data-structure/).

## 1. Ingestion & parsing
- [ ] Implement spec intake (file/URL/text) + format detection.
- [ ] Integrate parser/validator; dereference + resolve components.
- [ ] Implement messy-spec fallbacks (missing operationId/schemas).

## 2. Normalization
- [ ] Map parsed model → IR (operations, params, bodies, responses, security schemes).
- [ ] Compute stable `source.hash` and per-operation stable ids.

## 3. Mapping engine
- [ ] Tool-name derivation (operationId / method+path) with collision handling.
- [ ] Merge params + body → JSON Schema inputSchema; build `paramMap`.
- [ ] Response shaping options (passthrough/summarize/jsonpath) + error map.
- [ ] Optional resource/prompt emission for read-only ops.

## 4. Curation
- [ ] Apply include/exclude, rename, regroup, description/schema edits deterministically.
- [ ] Apply curation from **curation_profiles** when compiling Manifest; persist profile via API/DB layer.
- [ ] Store ingested specs in **source_specs** (via API persistence, not generator directly).

## 5. Tool-explosion mitigation
- [ ] Filtering by tag/path/method.
- [ ] Grouping support.
- [ ] Meta-tool pattern (`search_tools` / `invoke_operation`).

## 6. Validation
- [ ] Wire shared Manifest validator (from data-structure).
- [ ] Add conformance checks; produce structured errors/warnings.

## 7. Regeneration & diff
- [ ] Re-map updated spec; re-apply stored curation by stable id.
- [ ] Produce structured diff (added/removed/changed tools + schema changes).

## 8. Determinism
- [ ] Canonical JSON output + stable sorting; round-trip determinism test.

## Definition of done
- Fixtures (simple + large + messy specs) produce valid, deterministic Manifests; regeneration diff works; validation surfaces actionable errors.
