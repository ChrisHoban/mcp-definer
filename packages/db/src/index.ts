export { runMigrations, DEFAULT_DATABASE_URL, DEV_DATABASE_URL } from './migrate.js';
export {
  DEV_API_KEY,
  MissingEnvError,
  allowsDevDefaults,
  requireEnv,
  resolveApiKey,
  resolveDatabaseUrl,
} from './env.js';
export {
  createPool,
  validateDatabase,
  closePool,
  type DbPool,
  type DatabaseHealth,
} from './pool.js';

export interface DiscoveryIndexRow {
  org_slug: string;
  mcp_id: string;
  mcp_slug: string;
  name: string;
  description: string;
  visibility: 'private' | 'org' | 'public';
  version_id: string;
  latest_version: string;
  channel: string;
  mcp_protocol_version: string;
  manifest_schema_version: string;
  published_at: Date;
  deprecated_at: Date | null;
  tool_count: number;
  tool_names: string[];
  tags: string[];
}

/** SQL to refresh the discovery materialized view after publish/deprecate. */
export const REFRESH_DISCOVERY_INDEX_SQL = 'SELECT refresh_discovery_index()';

/** Query discovery index entries (requires migrations applied). */
export const DISCOVERY_INDEX_QUERY = `
  SELECT
    org_slug,
    mcp_id,
    mcp_slug,
    name,
    description,
    visibility,
    version_id,
    latest_version,
    channel,
    mcp_protocol_version,
    manifest_schema_version,
    published_at,
    deprecated_at,
    tool_count,
    tool_names,
    tags
  FROM discovery_index
  ORDER BY org_slug, mcp_slug
`;
