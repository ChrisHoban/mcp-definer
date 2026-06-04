-- Search and query indexes (A1)

-- MCP catalog text search
CREATE INDEX mcps_name_trgm_idx ON mcps USING gin (name gin_trgm_ops);
CREATE INDEX mcps_description_trgm_idx ON mcps USING gin (description gin_trgm_ops);
CREATE INDEX mcps_org_id_idx ON mcps (org_id);
CREATE INDEX mcps_visibility_idx ON mcps (visibility);

-- Tools denormalized search
CREATE INDEX tools_name_trgm_idx ON tools USING gin (name gin_trgm_ops);
CREATE INDEX tools_description_trgm_idx ON tools USING gin (description gin_trgm_ops);
CREATE INDEX tools_mcp_version_id_idx ON tools (mcp_version_id);
CREATE INDEX tools_tags_gin_idx ON tools USING gin (tags);
CREATE INDEX tools_input_schema_gin_idx ON tools USING gin (input_schema);

-- JSONB document indexes
CREATE INDEX manifests_content_gin_idx ON manifests USING gin (content);
CREATE INDEX curation_profiles_content_gin_idx ON curation_profiles USING gin (content);

-- Version lookups
CREATE INDEX mcp_versions_mcp_id_idx ON mcp_versions (mcp_id);
CREATE INDEX mcp_versions_published_at_idx ON mcp_versions (published_at) WHERE published_at IS NOT NULL;
CREATE INDEX mcp_versions_channel_idx ON mcp_versions (channel);

-- Source specs: latest per MCP
CREATE INDEX source_specs_mcp_ingested_idx ON source_specs (mcp_id, ingested_at DESC);

-- Tags
CREATE INDEX mcp_tags_tag_id_idx ON mcp_tags (tag_id);

-- Audit trail
CREATE INDEX audit_events_org_created_idx ON audit_events (org_id, created_at DESC);
CREATE INDEX audit_events_target_idx ON audit_events (target_type, target_id);

-- Membership lookups
CREATE INDEX org_memberships_user_id_idx ON org_memberships (user_id);
