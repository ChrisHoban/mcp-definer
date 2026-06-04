# Manifest schema version upgrades

`manifestSchemaVersion` is an independent version axis (NFR-11). Changes require:

1. **ADR** — Record the change in [`ARCHITECTURE_DECISIONS.md`](../../ARCHITECTURE_DECISIONS.md) with migration rationale.
2. **JSON Schema** — Add a new schema file (e.g. `manifest.schema.v2.json`) or bump the const in `manifest.schema.json` with a migration note.
3. **Validator** — Extend `validateManifest()` in `@mcp-definer/schemas` to accept the new version (or provide `validateManifestV2()` during transition).
4. **Database** — Store `manifest_schema_version` on `mcp_versions`; existing published rows remain on their original version.
5. **Migration path** — Provide a transform function (Generator/Registry) from N → N+1; never silently rewrite published manifests.

Published manifests are immutable (ADR-006). Upgrades apply only to **draft** versions or via **new published semver** after author review.
