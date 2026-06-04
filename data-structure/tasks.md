# Data Structure — Tasks

Ordered. This component is on the critical path; complete the schema first to unblock Generator, Runtime, Registry.

## 1. Manifest & IR schema (do first)
- [ ] Author JSON Schema for IR v1.0.
- [ ] Author JSON Schema for Manifest v1.0 (tools, resources, prompts, auth binding, transport, policies).
- [ ] Author JSON Schema for CurationProfile v1.0.
- [ ] Define deterministic serialization rules (key ordering, canonical JSON).
- [ ] Generate shared TypeScript types from the schemas (consumed by all components).
- [ ] Provide example Manifests (apiKey, bearer, OAuth2 cases) as fixtures.

## 2. Relational model
- [ ] Write DDL for all tables (orgs, users, **org_memberships**, mcps, **source_specs**, mcp_versions, manifests, **curation_profiles**, tools, credential_bindings, tags, mcp_tags, install_targets, audit_events).
- [ ] Add constraints: `unique(org_id, slug)`, `unique(mcp_id, version)`, FKs.
- [ ] Implement immutability enforcement for published versions/manifests (DB trigger or service-layer guard).
- [ ] Add indexes: FTS/trigram on names/descriptions; GIN on JSONB + tag arrays.

## 3. Discovery read view
- [ ] Design the materialized/cached discovery view (mcp + latest published version + tool summary).
- [ ] Define refresh trigger on publish/deprecate.

## 4. Migrations & versioning
- [ ] Set up migration tooling.
- [ ] Document `manifestSchemaVersion` upgrade procedure + ADR requirement.

## 5. Validation utilities
- [ ] Manifest validator (JSON Schema + semantic checks) shared with Generator/API publish step.
- [ ] Round-trip determinism test.

## Definition of done
- Schemas published + typed; DDL + migrations applied; immutability enforced; discovery view queryable; validator passes on all fixtures.
