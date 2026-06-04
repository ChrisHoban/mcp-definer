-- Discovery read view (DR-06, ADR-007, ADR-010)
-- Refreshed on publish/deprecate via refresh_discovery_index()

CREATE MATERIALIZED VIEW discovery_index AS
SELECT
  o.slug AS org_slug,
  m.id AS mcp_id,
  m.slug AS mcp_slug,
  m.name,
  m.description,
  m.visibility,
  mv.id AS version_id,
  mv.version AS latest_version,
  mv.channel,
  mv.mcp_protocol_version,
  mv.manifest_schema_version,
  mv.published_at,
  mv.deprecated_at,
  COUNT(t.id) FILTER (WHERE t.enabled) AS tool_count,
  COALESCE(
    ARRAY_AGG(t.name ORDER BY t.name) FILTER (WHERE t.enabled),
    ARRAY[]::TEXT[]
  ) AS tool_names,
  COALESCE(
    ARRAY_AGG(DISTINCT tag.label ORDER BY tag.label),
    ARRAY[]::TEXT[]
  ) AS tags
FROM mcps m
JOIN organizations o ON o.id = m.org_id
JOIN mcp_versions mv ON mv.id = m.latest_version_id
LEFT JOIN tools t ON t.mcp_version_id = mv.id
LEFT JOIN mcp_tags mt ON mt.mcp_id = m.id
LEFT JOIN tags tag ON tag.id = mt.tag_id
WHERE mv.published_at IS NOT NULL
GROUP BY
  o.slug,
  m.id,
  m.slug,
  m.name,
  m.description,
  m.visibility,
  mv.id,
  mv.version,
  mv.channel,
  mv.mcp_protocol_version,
  mv.manifest_schema_version,
  mv.published_at,
  mv.deprecated_at;

CREATE UNIQUE INDEX discovery_index_org_mcp_unique
  ON discovery_index (org_slug, mcp_slug);

CREATE INDEX discovery_index_visibility_idx ON discovery_index (visibility);
CREATE INDEX discovery_index_tool_names_gin_idx ON discovery_index USING gin (tool_names);
CREATE INDEX discovery_index_tags_gin_idx ON discovery_index USING gin (tags);
CREATE INDEX discovery_index_name_trgm_idx ON discovery_index USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION refresh_discovery_index()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY discovery_index;
END;
$$ LANGUAGE plpgsql;

COMMENT ON MATERIALIZED VIEW discovery_index IS
  'Cache-first discovery catalog. Call refresh_discovery_index() after publish/deprecate.';
