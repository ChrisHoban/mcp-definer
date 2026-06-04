-- Immutability enforcement for published versions and manifests (ADR-006)

CREATE OR REPLACE FUNCTION reject_published_mcp_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.published_at IS NOT NULL THEN
    IF NEW.published_at IS DISTINCT FROM OLD.published_at
       OR NEW.mcp_id IS DISTINCT FROM OLD.mcp_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.manifest_id IS DISTINCT FROM OLD.manifest_id
       OR NEW.curation_profile_id IS DISTINCT FROM OLD.curation_profile_id
       OR NEW.mcp_protocol_version IS DISTINCT FROM OLD.mcp_protocol_version
       OR NEW.manifest_schema_version IS DISTINCT FROM OLD.manifest_schema_version
       OR NEW.source_spec_id IS DISTINCT FROM OLD.source_spec_id
       OR NEW.published_by IS DISTINCT FROM OLD.published_by
       OR NEW.signature IS DISTINCT FROM OLD.signature
    THEN
      RAISE EXCEPTION 'Published MCP version % is immutable (409)', OLD.id
        USING ERRCODE = '23506';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.published_at IS NOT NULL THEN
    RAISE EXCEPTION 'Published MCP version % cannot be deleted (409)', OLD.id
      USING ERRCODE = '23506';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mcp_versions_immutability
  BEFORE UPDATE OR DELETE ON mcp_versions
  FOR EACH ROW
  EXECUTE FUNCTION reject_published_mcp_version_mutation();

CREATE OR REPLACE FUNCTION reject_immutable_manifest_mutation()
RETURNS TRIGGER AS $$
DECLARE
  published_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO published_count
  FROM mcp_versions mv
  WHERE mv.manifest_id = OLD.id
    AND mv.published_at IS NOT NULL;

  IF published_count > 0 THEN
    RAISE EXCEPTION 'Manifest % is immutable — referenced by published version (409)', OLD.id
      USING ERRCODE = '23506';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER manifests_immutability
  BEFORE UPDATE OR DELETE ON manifests
  FOR EACH ROW
  EXECUTE FUNCTION reject_immutable_manifest_mutation();

CREATE OR REPLACE FUNCTION reject_immutable_curation_profile_mutation()
RETURNS TRIGGER AS $$
DECLARE
  published_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO published_count
  FROM mcp_versions mv
  WHERE mv.id = OLD.mcp_version_id
    AND mv.published_at IS NOT NULL;

  IF published_count > 0 THEN
    RAISE EXCEPTION 'Curation profile % is immutable — version is published (409)', OLD.id
      USING ERRCODE = '23506';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER curation_profiles_immutability
  BEFORE UPDATE OR DELETE ON curation_profiles
  FOR EACH ROW
  EXECUTE FUNCTION reject_immutable_curation_profile_mutation();
