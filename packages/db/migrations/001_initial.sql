-- MCP Definer initial schema (A1)
-- Requires PostgreSQL 16+ with pgcrypto for gen_random_uuid()

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ---------------------------------------------------------------------------
-- Core tenancy
-- ---------------------------------------------------------------------------

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT organizations_slug_unique UNIQUE (slug),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z][a-z0-9-]*$')
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT org_memberships_org_user_unique UNIQUE (org_id, user_id),
  CONSTRAINT org_memberships_role_check CHECK (role IN ('owner', 'admin', 'author', 'viewer'))
);

-- ---------------------------------------------------------------------------
-- MCP catalog
-- ---------------------------------------------------------------------------

CREATE TABLE mcps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_spec_type TEXT,
  source_spec_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  latest_version_id UUID,
  status TEXT NOT NULL DEFAULT 'draft',
  owner_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mcps_org_slug_unique UNIQUE (org_id, slug),
  CONSTRAINT mcps_slug_format CHECK (slug ~ '^[a-z][a-z0-9_-]*$'),
  CONSTRAINT mcps_visibility_check CHECK (visibility IN ('private', 'org', 'public')),
  CONSTRAINT mcps_status_check CHECK (status IN ('draft', 'published', 'deprecated', 'retired'))
);

CREATE TABLE manifests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT manifests_content_hash_unique UNIQUE (content_hash)
);

CREATE TABLE source_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_id UUID NOT NULL REFERENCES mcps(id) ON DELETE CASCADE,
  spec_hash TEXT NOT NULL,
  spec_type TEXT NOT NULL,
  content_text TEXT,
  storage_ref TEXT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ingested_by UUID NOT NULL REFERENCES users(id),
  CONSTRAINT source_specs_spec_hash_format CHECK (spec_hash ~ '^sha256:[a-f0-9]{64}$'),
  CONSTRAINT source_specs_content_or_storage CHECK (
    content_text IS NOT NULL OR storage_ref IS NOT NULL
  )
);

CREATE TABLE mcp_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_id UUID NOT NULL REFERENCES mcps(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'draft',
  manifest_id UUID NOT NULL REFERENCES manifests(id),
  curation_profile_id UUID,
  mcp_protocol_version TEXT NOT NULL DEFAULT '2024-11-05',
  manifest_schema_version TEXT NOT NULL DEFAULT '1.0',
  source_spec_id UUID REFERENCES source_specs(id),
  changelog TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  signature TEXT,
  published_by UUID REFERENCES users(id),
  deprecated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mcp_versions_mcp_version_unique UNIQUE (mcp_id, version),
  CONSTRAINT mcp_versions_channel_check CHECK (channel IN ('draft', 'stable', 'beta')),
  CONSTRAINT mcp_versions_published_requires_actor CHECK (
    published_at IS NULL OR published_by IS NOT NULL
  )
);

CREATE TABLE curation_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_version_id UUID NOT NULL REFERENCES mcp_versions(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT curation_profiles_version_unique UNIQUE (mcp_version_id)
);

ALTER TABLE mcp_versions
  ADD CONSTRAINT mcp_versions_curation_profile_fk
  FOREIGN KEY (curation_profile_id) REFERENCES curation_profiles(id);

ALTER TABLE mcps
  ADD CONSTRAINT mcps_latest_version_fk
  FOREIGN KEY (latest_version_id) REFERENCES mcp_versions(id);

CREATE TABLE tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_version_id UUID NOT NULL REFERENCES mcp_versions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  input_schema JSONB NOT NULL,
  http_method TEXT NOT NULL,
  path_template TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  tool_group TEXT,
  CONSTRAINT tools_version_name_unique UNIQUE (mcp_version_id, name),
  CONSTRAINT tools_http_method_check CHECK (
    http_method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')
  )
);

CREATE TABLE credential_bindings (
  id TEXT PRIMARY KEY,
  mcp_id UUID NOT NULL REFERENCES mcps(id) ON DELETE CASCADE,
  auth_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  secret_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT credential_bindings_mcp_unique UNIQUE (mcp_id),
  CONSTRAINT credential_bindings_auth_type_check CHECK (
    auth_type IN ('apiKey', 'bearer', 'oauth2_cc', 'oauth2_ac', 'basic', 'custom')
  ),
  CONSTRAINT credential_bindings_id_format CHECK (id ~ '^cb_[a-zA-Z0-9_]+$')
);

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  CONSTRAINT tags_org_label_unique UNIQUE (org_id, label)
);

CREATE TABLE mcp_tags (
  mcp_id UUID NOT NULL REFERENCES mcps(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (mcp_id, tag_id)
);

CREATE TABLE install_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mcp_version_id UUID NOT NULL REFERENCES mcp_versions(id) ON DELETE CASCADE,
  harness TEXT NOT NULL,
  transport TEXT NOT NULL,
  config_snippet JSONB NOT NULL,
  instructions TEXT NOT NULL DEFAULT '',
  CONSTRAINT install_targets_version_harness_unique UNIQUE (mcp_version_id, harness),
  CONSTRAINT install_targets_harness_check CHECK (
    harness IN ('cursor', 'claude-desktop', 'generic')
  ),
  CONSTRAINT install_targets_transport_check CHECK (transport IN ('stdio', 'http'))
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Migration tracking (used by migrate.mjs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
