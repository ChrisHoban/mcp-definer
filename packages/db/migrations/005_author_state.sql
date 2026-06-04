-- Persist wizard authoring progress per draft version (step, warnings, etc.)

ALTER TABLE mcp_versions
  ADD COLUMN IF NOT EXISTS author_state JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS mcp_versions_author_state_gin_idx
  ON mcp_versions USING gin (author_state);
