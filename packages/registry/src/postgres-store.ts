import type { CurationProfile, Manifest } from '@mcp-definer/schemas';
import { MCP_PROTOCOL_VERSION } from '@mcp-definer/schemas';
import {
  closePool,
  type DbPool,
  type DiscoveryIndexRow,
  REFRESH_DISCOVERY_INDEX_SQL,
} from '@mcp-definer/db';
import { discoveryRowsToEntries } from './discovery-index.js';

import { RegistryError } from './errors.js';
import {
  curationHash,
  installTargetsForVersion,
  manifestHash,
  pgToolsFromManifest,
  sha256SpecHash,
  stubUserEmail,
} from './store-utils.js';
import type {
  AuditEvent,
  AuthorState,
  ControlPlaneRegistryStore,
  CreateDraftVersionInput,
  CreateMcpInput,
  ListMcpsFilter,
  SourceSpecInput,
  StoredInstallTarget,
  StoredManifest,
  StoredMcp,
  StoredMcpVersion,
  DiscoveryIndexEntry,
  ListDiscoveryIndexOptions,
  StoredOrganization,
  StoredSourceSpec,
  StoredTool,
  UpdateDraftVersionInput,
  VersionAuthoringData,
} from './types.js';

interface McpRow {
  id: string;
  org_id: string;
  org_slug: string;
  slug: string;
  name: string;
  description: string;
  visibility: StoredMcp['visibility'];
  latest_version_id: string | null;
  status: StoredMcp['status'];
  owner_id: string;
  tags: string[];
}

interface VersionRow {
  id: string;
  mcp_id: string;
  version: string;
  channel: StoredMcpVersion['channel'];
  manifest_id: string;
  mcp_protocol_version: string;
  manifest_schema_version: string;
  published_at: Date | null;
  published_by: string | null;
  deprecated_at: Date | null;
  created_at: Date;
  author_state: AuthorState;
}

function mapMcpRow(row: McpRow): StoredMcp {
  return {
    id: row.id,
    orgId: row.org_id,
    orgSlug: row.org_slug,
    slug: row.slug,
    name: row.name,
    description: row.description,
    visibility: row.visibility,
    latestVersionId: row.latest_version_id,
    status: row.status,
    ownerId: row.owner_id,
    tags: row.tags ?? [],
  };
}

function mapVersionRow(row: VersionRow): StoredMcpVersion {
  return {
    id: row.id,
    mcpId: row.mcp_id,
    version: row.version,
    channel: row.channel,
    manifestId: row.manifest_id,
    mcpProtocolVersion: row.mcp_protocol_version,
    manifestSchemaVersion: row.manifest_schema_version,
    publishedAt: row.published_at?.toISOString() ?? null,
    publishedBy: row.published_by,
    deprecatedAt: row.deprecated_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export interface PostgresRegistryStoreOptions {
  pool: DbPool;
  defaultOrgSlug: string;
  defaultUserStubId: string;
}

export class PostgresRegistryStore implements ControlPlaneRegistryStore {
  private readonly pool: DbPool;
  private readonly defaultOrgSlug: string;
  private readonly defaultUserStubId: string;

  constructor(options: PostgresRegistryStoreOptions) {
    this.pool = options.pool;
    this.defaultOrgSlug = options.defaultOrgSlug;
    this.defaultUserStubId = options.defaultUserStubId;
  }

  async close(): Promise<void> {
    await closePool(this.pool);
  }

  async ensureOrg(slug: string, name?: string): Promise<StoredOrganization> {
    const result = await this.pool.query<{ id: string; slug: string; name: string }>(
      `INSERT INTO organizations (slug, name)
       VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, slug, name`,
      [slug, name ?? slug],
    );
    const row = result.rows[0]!;
    return { id: row.id, slug: row.slug, name: row.name };
  }

  async ensureUser(stubUserId: string, displayName?: string): Promise<{ id: string }> {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(stubUserId)) {
      const existing = await this.pool.query<{ id: string }>(
        `SELECT id FROM users WHERE id = $1`,
        [stubUserId],
      );
      if (existing.rows[0]) {
        return { id: existing.rows[0].id };
      }
    }

    const email = stubUserEmail(stubUserId);
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO users (email, display_name)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [email, displayName ?? stubUserId],
    );
    return { id: result.rows[0]!.id };
  }

  private async fetchMcpTags(mcpId: string): Promise<string[]> {
    const result = await this.pool.query<{ label: string }>(
      `SELECT t.label
       FROM mcp_tags mt
       JOIN tags t ON t.id = mt.tag_id
       WHERE mt.mcp_id = $1
       ORDER BY t.label`,
      [mcpId],
    );
    return result.rows.map((row) => row.label);
  }

  private async queryMcpById(mcpId: string): Promise<McpRow | null> {
    const result = await this.pool.query<McpRow>(
      `SELECT m.id, m.org_id, o.slug AS org_slug, m.slug, m.name, m.description,
              m.visibility, m.latest_version_id, m.status, m.owner_id,
              COALESCE(
                (SELECT array_agg(t.label ORDER BY t.label)
                 FROM mcp_tags mt
                 JOIN tags t ON t.id = mt.tag_id
                 WHERE mt.mcp_id = m.id),
                '{}'
              ) AS tags
       FROM mcps m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.id = $1`,
      [mcpId],
    );
    return result.rows[0] ?? null;
  }

  async createMcp(input: CreateMcpInput): Promise<{ mcp: StoredMcp; version: StoredMcpVersion }> {
    const org = await this.ensureOrg(input.org);
    const user = await this.ensureUser(input.ownerId);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM mcps WHERE org_id = $1 AND slug = $2`,
        [org.id, input.slug],
      );
      if (existing.rowCount) {
        throw new RegistryError('CONFLICT', `MCP already exists: ${input.org}/${input.slug}`);
      }

      const mcpResult = await client.query<{ id: string }>(
        `INSERT INTO mcps (org_id, slug, name, description, visibility, status, owner_id, source_spec_type)
         VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7)
         RETURNING id`,
        [
          org.id,
          input.slug,
          input.name,
          input.description,
          input.visibility,
          user.id,
          input.sourceSpec?.specType ?? null,
        ],
      );
      const mcpId = mcpResult.rows[0]!.id;

      await this.syncTags(client, org.id, mcpId, input.tags ?? []);

      const version = await this.insertDraftVersion(client, {
        mcpId,
        orgSlug: input.org,
        slug: input.slug,
        version: input.version,
        manifest: input.manifest,
        ownerId: user.id,
        sourceSpec: input.sourceSpec,
        curation: input.curation,
        authorState: input.authorState,
      });

      await client.query('COMMIT');

      const mcpRow = await this.queryMcpById(mcpId);
      return { mcp: mapMcpRow(mcpRow!), version };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async syncTags(
    client: Pick<import('pg').PoolClient, 'query'>,
    orgId: string,
    mcpId: string,
    tags: string[],
  ): Promise<void> {
    await client.query(`DELETE FROM mcp_tags WHERE mcp_id = $1`, [mcpId]);
    for (const label of tags) {
      const tag = await client.query<{ id: string }>(
        `INSERT INTO tags (org_id, label)
         VALUES ($1, $2)
         ON CONFLICT (org_id, label) DO UPDATE SET label = EXCLUDED.label
         RETURNING id`,
        [orgId, label],
      );
      await client.query(`INSERT INTO mcp_tags (mcp_id, tag_id) VALUES ($1, $2)`, [
        mcpId,
        tag.rows[0]!.id,
      ]);
    }
  }

  private async upsertManifest(
    client: import('pg').PoolClient,
    manifest: Manifest,
  ): Promise<string> {
    const hash = manifestHash(manifest);
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM manifests WHERE content_hash = $1`,
      [hash],
    );
    if (existing.rows[0]) {
      return existing.rows[0].id;
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO manifests (content, content_hash) VALUES ($1, $2) RETURNING id`,
      [manifest, hash],
    );
    return inserted.rows[0]!.id;
  }

  private async insertSourceSpec(
    client: import('pg').PoolClient,
    mcpId: string,
    ownerId: string,
    sourceSpec: SourceSpecInput,
  ): Promise<string> {
    const specHash = sourceSpec.specHash ?? sha256SpecHash(sourceSpec.specText);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO source_specs (mcp_id, spec_hash, spec_type, content_text, ingested_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [mcpId, specHash, sourceSpec.specType, sourceSpec.specText, ownerId],
    );
    return inserted.rows[0]!.id;
  }

  private async insertDraftVersion(
    client: import('pg').PoolClient,
    input: {
      mcpId: string;
      orgSlug: string;
      slug: string;
      version: string;
      manifest: Manifest;
      ownerId: string;
      sourceSpec?: SourceSpecInput;
      curation?: CurationProfile;
      authorState?: AuthorState;
    },
  ): Promise<StoredMcpVersion> {
    const manifestId = await this.upsertManifest(client, input.manifest);
    let sourceSpecId: string | null = null;
    if (input.sourceSpec?.specText) {
      sourceSpecId = await this.insertSourceSpec(
        client,
        input.mcpId,
        input.ownerId,
        input.sourceSpec,
      );
      await client.query(`UPDATE mcps SET source_spec_type = $1 WHERE id = $2`, [
        input.sourceSpec.specType,
        input.mcpId,
      ]);
    }

    const versionResult = await client.query<VersionRow>(
      `INSERT INTO mcp_versions (
         mcp_id, version, channel, manifest_id, mcp_protocol_version,
         manifest_schema_version, source_spec_id, author_state
       )
       VALUES ($1, $2, 'draft', $3, $4, $5, $6, $7::jsonb)
       RETURNING id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
                 manifest_schema_version, published_at, published_by, deprecated_at,
                 created_at, author_state`,
      [
        input.mcpId,
        input.version,
        manifestId,
        input.manifest.mcpProtocolVersion ?? MCP_PROTOCOL_VERSION,
        input.manifest.manifestSchemaVersion,
        sourceSpecId,
        JSON.stringify(input.authorState ?? {}),
      ],
    );
    const versionRow = versionResult.rows[0]!;

    if (input.curation) {
      const profile = await client.query<{ id: string }>(
        `INSERT INTO curation_profiles (mcp_version_id, content, content_hash)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [versionRow.id, input.curation, curationHash(input.curation)],
      );
      await client.query(`UPDATE mcp_versions SET curation_profile_id = $1 WHERE id = $2`, [
        profile.rows[0]!.id,
        versionRow.id,
      ]);
    }

    await this.syncTools(client, versionRow.id, input.manifest);
    await this.syncInstallTargets(client, versionRow.id);

    return mapVersionRow(versionRow);
  }

  private async syncTools(
    client: import('pg').PoolClient,
    versionId: string,
    manifest: Manifest,
  ): Promise<void> {
    await client.query(`DELETE FROM tools WHERE mcp_version_id = $1`, [versionId]);
    for (const tool of pgToolsFromManifest(manifest, versionId)) {
      await client.query(
        `INSERT INTO tools (
           mcp_version_id, name, description, input_schema, http_method,
           path_template, tags, enabled, tool_group
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          tool.mcpVersionId,
          tool.name,
          tool.description,
          tool.inputSchema,
          tool.httpMethod,
          tool.pathTemplate,
          tool.tags,
          tool.enabled,
          tool.toolGroup,
        ],
      );
    }
  }

  private async syncInstallTargets(
    client: import('pg').PoolClient,
    versionId: string,
  ): Promise<void> {
    const targets = installTargetsForVersion(versionId);
    for (const target of targets) {
      await client.query(
        `INSERT INTO install_targets (mcp_version_id, harness, transport, config_snippet, instructions)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (mcp_version_id, harness) DO UPDATE
           SET transport = EXCLUDED.transport,
               config_snippet = EXCLUDED.config_snippet,
               instructions = EXCLUDED.instructions`,
        [
          versionId,
          target.harness,
          target.transport,
          target.configSnippet,
          target.instructions,
        ],
      );
    }
  }

  async listMcps(filter: ListMcpsFilter = {}): Promise<{ items: StoredMcp[]; nextCursor: string | null }> {
    const limit = Math.min(filter.limit ?? 50, 100);
    const params: unknown[] = [];
    const conditions = [`m.status <> 'retired'`];

    if (filter.status) {
      params.push(filter.status);
      conditions.push(`m.status = $${params.length}`);
    }
    if (filter.visibility) {
      params.push(filter.visibility);
      conditions.push(`m.visibility = $${params.length}`);
    }
    if (filter.tag) {
      params.push(filter.tag);
      conditions.push(`EXISTS (
        SELECT 1 FROM mcp_tags mt
        JOIN tags t ON t.id = mt.tag_id
        WHERE mt.mcp_id = m.id AND t.label = $${params.length}
      )`);
    }
    if (filter.cursor) {
      params.push(filter.cursor);
      conditions.push(`m.id > $${params.length}`);
    }

    params.push(limit + 1);
    const result = await this.pool.query<McpRow>(
      `SELECT m.id, m.org_id, o.slug AS org_slug, m.slug, m.name, m.description,
              m.visibility, m.latest_version_id, m.status, m.owner_id,
              COALESCE(
                (SELECT array_agg(t.label ORDER BY t.label)
                 FROM mcp_tags mt
                 JOIN tags t ON t.id = mt.tag_id
                 WHERE mt.mcp_id = m.id),
                '{}'
              ) AS tags
       FROM mcps m
       JOIN organizations o ON o.id = m.org_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.id
       LIMIT $${params.length}`,
      params,
    );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null;
    return { items: page.map(mapMcpRow), nextCursor };
  }

  async updateMcp(
    mcpId: string,
    updates: Partial<Pick<StoredMcp, 'name' | 'description' | 'visibility' | 'tags'>>,
  ): Promise<StoredMcp> {
    const existing = await this.queryMcpById(mcpId);
    if (!existing) {
      throw new RegistryError('NOT_FOUND', `MCP not found: ${mcpId}`);
    }
    if (existing.status === 'retired') {
      throw new RegistryError('NOT_FOUND', `MCP archived: ${mcpId}`);
    }

    await this.pool.query(
      `UPDATE mcps
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           visibility = COALESCE($4, visibility),
           updated_at = now()
       WHERE id = $1`,
      [mcpId, updates.name ?? null, updates.description ?? null, updates.visibility ?? null],
    );

    if (updates.tags) {
      await this.syncTags(this.pool, existing.org_id, mcpId, updates.tags);
    }

    const row = await this.queryMcpById(mcpId);
    return mapMcpRow(row!);
  }

  async archiveMcp(mcpId: string): Promise<StoredMcp> {
    const existing = await this.queryMcpById(mcpId);
    if (!existing) {
      throw new RegistryError('NOT_FOUND', `MCP not found: ${mcpId}`);
    }
    await this.pool.query(`UPDATE mcps SET status = 'retired', updated_at = now() WHERE id = $1`, [
      mcpId,
    ]);
    const row = await this.queryMcpById(mcpId);
    return mapMcpRow(row!);
  }

  async listVersions(mcpId: string): Promise<StoredMcpVersion[]> {
    const result = await this.pool.query<VersionRow>(
      `SELECT id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
              manifest_schema_version, published_at, published_by, deprecated_at,
              created_at, author_state
       FROM mcp_versions
       WHERE mcp_id = $1
       ORDER BY created_at DESC`,
      [mcpId],
    );
    return result.rows.map(mapVersionRow);
  }

  async createDraftVersion(input: CreateDraftVersionInput): Promise<StoredMcpVersion> {
    const mcp = await this.getMcp(input.org, input.slug);
    if (!mcp) {
      throw new RegistryError('NOT_FOUND', `MCP not found: ${input.org}/${input.slug}`);
    }
    const user = await this.ensureUser(input.ownerId);

    const client = await this.pool.connect();
    let version: StoredMcpVersion;
    try {
      await client.query('BEGIN');
      version = await this.insertDraftVersion(client, {
        mcpId: mcp.id,
        orgSlug: input.org,
        slug: input.slug,
        version: input.version,
        manifest: input.manifest,
        ownerId: user.id,
        sourceSpec: input.sourceSpec,
        curation: input.curation,
        authorState: input.authorState,
      });
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    if (input.name || input.description || input.visibility || input.tags) {
      await this.updateMcp(mcp.id, {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        tags: input.tags,
      });
    }

    return version;
  }

  async getMcp(org: string, slug: string): Promise<StoredMcp | null> {
    const result = await this.pool.query<McpRow>(
      `SELECT m.id, m.org_id, o.slug AS org_slug, m.slug, m.name, m.description,
              m.visibility, m.latest_version_id, m.status, m.owner_id,
              COALESCE(
                (SELECT array_agg(t.label ORDER BY t.label)
                 FROM mcp_tags mt
                 JOIN tags t ON t.id = mt.tag_id
                 WHERE mt.mcp_id = m.id),
                '{}'
              ) AS tags
       FROM mcps m
       JOIN organizations o ON o.id = m.org_id
       WHERE o.slug = $1 AND m.slug = $2`,
      [org, slug],
    );
    return result.rows[0] ? mapMcpRow(result.rows[0]) : null;
  }

  async getMcpById(mcpId: string): Promise<StoredMcp | null> {
    const row = await this.queryMcpById(mcpId);
    return row ? mapMcpRow(row) : null;
  }

  async getVersion(org: string, slug: string, version: string): Promise<StoredMcpVersion | null> {
    const mcp = await this.getMcp(org, slug);
    if (!mcp) {
      return null;
    }
    return this.getVersionForMcp(mcp.id, version);
  }

  async getVersionById(versionId: string): Promise<StoredMcpVersion | null> {
    const result = await this.pool.query<VersionRow>(
      `SELECT id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
              manifest_schema_version, published_at, published_by, deprecated_at,
              created_at, author_state
       FROM mcp_versions WHERE id = $1`,
      [versionId],
    );
    return result.rows[0] ? mapVersionRow(result.rows[0]) : null;
  }

  async getVersionForMcp(mcpId: string, version: string): Promise<StoredMcpVersion | null> {
    const result = await this.pool.query<VersionRow>(
      `SELECT id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
              manifest_schema_version, published_at, published_by, deprecated_at,
              created_at, author_state
       FROM mcp_versions
       WHERE mcp_id = $1 AND version = $2`,
      [mcpId, version],
    );
    return result.rows[0] ? mapVersionRow(result.rows[0]) : null;
  }

  async getManifestById(manifestId: string): Promise<StoredManifest | null> {
    const result = await this.pool.query<{
      id: string;
      content: Manifest;
      content_hash: string;
      created_at: Date;
    }>(`SELECT id, content, content_hash, created_at FROM manifests WHERE id = $1`, [manifestId]);
    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      content: row.content,
      contentHash: row.content_hash,
      createdAt: row.created_at.toISOString(),
    };
  }

  async getToolsForVersion(versionId: string): Promise<StoredTool[]> {
    const result = await this.pool.query<{
      id: string;
      mcp_version_id: string;
      name: string;
      description: string;
      enabled: boolean;
      tags: string[];
    }>(
      `SELECT id, mcp_version_id, name, description, enabled, tags
       FROM tools WHERE mcp_version_id = $1 ORDER BY name`,
      [versionId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      mcpVersionId: row.mcp_version_id,
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      tags: row.tags ?? [],
    }));
  }

  async getInstallTargets(versionId: string): Promise<StoredInstallTarget[]> {
    const result = await this.pool.query<{
      id: string;
      mcp_version_id: string;
      harness: StoredInstallTarget['harness'];
      transport: StoredInstallTarget['transport'];
      config_snippet: StoredInstallTarget['configSnippet'];
      instructions: string;
    }>(
      `SELECT id, mcp_version_id, harness, transport, config_snippet, instructions
       FROM install_targets WHERE mcp_version_id = $1`,
      [versionId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      mcpVersionId: row.mcp_version_id,
      harness: row.harness,
      transport: row.transport,
      configSnippet: row.config_snippet,
      instructions: row.instructions,
    }));
  }

  async getVersionAuthoringData(versionId: string): Promise<VersionAuthoringData> {
    const version = await this.getVersionById(versionId);
    if (!version) {
      return { sourceSpec: null, curation: null, authorState: {} };
    }

    const specResult = await this.pool.query<{
      id: string;
      mcp_id: string;
      spec_hash: string;
      spec_type: string;
      content_text: string;
    }>(
      `SELECT ss.id, ss.mcp_id, ss.spec_hash, ss.spec_type, ss.content_text
       FROM mcp_versions mv
       JOIN source_specs ss ON ss.id = mv.source_spec_id
       WHERE mv.id = $1`,
      [versionId],
    );

    const curationResult = await this.pool.query<{ content: CurationProfile }>(
      `SELECT cp.content
       FROM mcp_versions mv
       JOIN curation_profiles cp ON cp.id = mv.curation_profile_id
       WHERE mv.id = $1`,
      [versionId],
    );

    const authorResult = await this.pool.query<{ author_state: AuthorState }>(
      `SELECT author_state FROM mcp_versions WHERE id = $1`,
      [versionId],
    );

    const specRow = specResult.rows[0];
    const sourceSpec: StoredSourceSpec | null = specRow
      ? {
          id: specRow.id,
          mcpId: specRow.mcp_id,
          specHash: specRow.spec_hash,
          specType: specRow.spec_type,
          contentText: specRow.content_text,
        }
      : null;

    return {
      sourceSpec,
      curation: curationResult.rows[0]?.content ?? null,
      authorState: authorResult.rows[0]?.author_state ?? {},
    };
  }

  async publishVersion(
    versionId: string,
    channel: 'stable' | 'beta',
    actorId: string,
  ): Promise<StoredMcpVersion> {
    const user = await this.ensureUser(actorId);
    const result = await this.pool.query<VersionRow>(
      `UPDATE mcp_versions
       SET channel = $2, published_at = now(), published_by = $3
       WHERE id = $1 AND published_at IS NULL
       RETURNING id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
                 manifest_schema_version, published_at, published_by, deprecated_at,
                 created_at, author_state`,
      [versionId, channel, user.id],
    );
    const row = result.rows[0];
    if (!row) {
      const existing = await this.getVersionById(versionId);
      if (!existing) {
        throw new RegistryError('NOT_FOUND', `Version not found: ${versionId}`);
      }
      throw new RegistryError('ALREADY_PUBLISHED', `Version already published: ${existing.version}`);
    }

    await this.pool.query(
      `UPDATE mcps SET status = 'published', latest_version_id = $2, updated_at = now()
       WHERE id = $1`,
      [row.mcp_id, versionId],
    );

    try {
      await this.pool.query(REFRESH_DISCOVERY_INDEX_SQL);
    } catch {
      /* discovery view may be empty on fresh DB */
    }

    return mapVersionRow(row);
  }

  async deprecateVersion(versionId: string, _actorId: string): Promise<StoredMcpVersion> {
    const result = await this.pool.query<VersionRow>(
      `UPDATE mcp_versions
       SET deprecated_at = now()
       WHERE id = $1 AND published_at IS NOT NULL
       RETURNING id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
                 manifest_schema_version, published_at, published_by, deprecated_at,
                 created_at, author_state`,
      [versionId],
    );
    const row = result.rows[0];
    if (!row) {
      const existing = await this.getVersionById(versionId);
      if (!existing) {
        throw new RegistryError('NOT_FOUND', `Version not found: ${versionId}`);
      }
      throw new RegistryError('CONFLICT', 'Cannot deprecate an unpublished version');
    }

    try {
      await this.pool.query(REFRESH_DISCOVERY_INDEX_SQL);
    } catch {
      /* ignore */
    }

    return mapVersionRow(row);
  }

  async updateDraftManifest(versionId: string, manifest: Manifest): Promise<StoredMcpVersion> {
    return this.updateDraftVersion(versionId, { manifest });
  }

  async updateDraftVersion(
    versionId: string,
    input: UpdateDraftVersionInput,
  ): Promise<StoredMcpVersion> {
    const existing = await this.getVersionById(versionId);
    if (!existing) {
      throw new RegistryError('NOT_FOUND', `Version not found: ${versionId}`);
    }
    if (existing.publishedAt) {
      throw new RegistryError('IMMUTABLE', `Published version is immutable: ${existing.version}`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let manifestId = existing.manifestId;
      if (input.manifest) {
        manifestId = await this.upsertManifest(client, input.manifest);
        await this.syncTools(client, versionId, input.manifest);
      }

      if (input.curation) {
        await client.query(
          `INSERT INTO curation_profiles (mcp_version_id, content, content_hash)
           VALUES ($1, $2, $3)
           ON CONFLICT (mcp_version_id) DO UPDATE
             SET content = EXCLUDED.content, content_hash = EXCLUDED.content_hash`,
          [versionId, input.curation, curationHash(input.curation)],
        );
        const profile = await client.query<{ id: string }>(
          `SELECT id FROM curation_profiles WHERE mcp_version_id = $1`,
          [versionId],
        );
        await client.query(`UPDATE mcp_versions SET curation_profile_id = $1 WHERE id = $2`, [
          profile.rows[0]!.id,
          versionId,
        ]);
      }

      if (input.sourceSpec?.specText) {
        const mcp = await this.getMcpById(existing.mcpId);
        const user = await this.ensureUser(this.defaultUserStubId);
        const sourceSpecId = await this.insertSourceSpec(
          client,
          existing.mcpId,
          user.id,
          input.sourceSpec,
        );
        await client.query(`UPDATE mcp_versions SET source_spec_id = $1 WHERE id = $2`, [
          sourceSpecId,
          versionId,
        ]);
        if (mcp) {
          await client.query(`UPDATE mcps SET source_spec_type = $1 WHERE id = $2`, [
            input.sourceSpec.specType,
            existing.mcpId,
          ]);
        }
      }

      const authorState = input.authorState;
      const result = await client.query<VersionRow>(
        `UPDATE mcp_versions
         SET manifest_id = $2,
             mcp_protocol_version = COALESCE($3, mcp_protocol_version),
             manifest_schema_version = COALESCE($4, manifest_schema_version),
             author_state = COALESCE($5::jsonb, author_state)
         WHERE id = $1
         RETURNING id, mcp_id, version, channel, manifest_id, mcp_protocol_version,
                   manifest_schema_version, published_at, published_by, deprecated_at,
                   created_at, author_state`,
        [
          versionId,
          manifestId,
          input.manifest?.mcpProtocolVersion ?? null,
          input.manifest?.manifestSchemaVersion ?? null,
          authorState ? JSON.stringify(authorState) : null,
        ],
      );

      await client.query('COMMIT');
      return mapVersionRow(result.rows[0]!);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async listPublishedMcps(): Promise<StoredMcp[]> {
    const result = await this.pool.query<McpRow>(
      `SELECT m.id, m.org_id, o.slug AS org_slug, m.slug, m.name, m.description,
              m.visibility, m.latest_version_id, m.status, m.owner_id,
              COALESCE(
                (SELECT array_agg(t.label ORDER BY t.label)
                 FROM mcp_tags mt
                 JOIN tags t ON t.id = mt.tag_id
                 WHERE mt.mcp_id = m.id),
                '{}'
              ) AS tags
       FROM mcps m
       JOIN organizations o ON o.id = m.org_id
       WHERE m.status = 'published' AND m.latest_version_id IS NOT NULL`,
    );
    return result.rows.map(mapMcpRow);
  }

  async getLatestPublishedVersion(mcpId: string): Promise<StoredMcpVersion | null> {
    const mcp = await this.getMcpById(mcpId);
    if (!mcp?.latestVersionId) {
      return null;
    }
    return this.getVersionById(mcp.latestVersionId);
  }

  async emitAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const result = await this.pool.query<{
      id: string;
      org_id: string;
      actor_id: string | null;
      action: string;
      target_type: string;
      target_id: string;
      metadata: Record<string, unknown>;
      created_at: Date;
    }>(
      `INSERT INTO audit_events (org_id, actor_id, action, target_type, target_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, org_id, actor_id, action, target_type, target_id, metadata, created_at`,
      [
        event.orgId,
        event.actorId,
        event.action,
        event.targetType,
        event.targetId,
        event.metadata,
      ],
    );
    const row = result.rows[0]!;
    return {
      id: row.id,
      orgId: row.org_id,
      actorId: row.actor_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString(),
    };
  }

  async listAuditEvents(orgId?: string): Promise<AuditEvent[]> {
    const result = orgId
      ? await this.pool.query<{
          id: string;
          org_id: string;
          actor_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          metadata: Record<string, unknown>;
          created_at: Date;
        }>(
          `SELECT id, org_id, actor_id, action, target_type, target_id, metadata, created_at
           FROM audit_events WHERE org_id = $1 ORDER BY created_at DESC`,
          [orgId],
        )
      : await this.pool.query(
          `SELECT id, org_id, actor_id, action, target_type, target_id, metadata, created_at
           FROM audit_events ORDER BY created_at DESC`,
        );

    return result.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      actorId: row.actor_id,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async listDiscoveryIndexEntries(
    options: ListDiscoveryIndexOptions,
  ): Promise<{ entries: DiscoveryIndexEntry[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit, 100);
    const baseUrl = (options.baseUrl ?? '/v1').replace(/\/+$/, '');

    const result = options.cursor
      ? await this.pool.query<DiscoveryIndexRow>(
          `SELECT org_slug, mcp_id, mcp_slug, name, description, visibility,
                  version_id, latest_version, channel, mcp_protocol_version,
                  manifest_schema_version, published_at, deprecated_at,
                  tool_count, tool_names, tags
           FROM discovery_index
           WHERE (org_slug, mcp_slug) > (
             split_part($1::text, '/', 1),
             split_part($1::text, '/', 2)
           )
           ORDER BY org_slug, mcp_slug
           LIMIT $2`,
          [options.cursor, limit + 1],
        )
      : await this.pool.query<DiscoveryIndexRow>(
          `SELECT org_slug, mcp_id, mcp_slug, name, description, visibility,
                  version_id, latest_version, channel, mcp_protocol_version,
                  manifest_schema_version, published_at, deprecated_at,
                  tool_count, tool_names, tags
           FROM discovery_index
           ORDER BY org_slug, mcp_slug
           LIMIT $1`,
          [limit + 1],
        );

    const rows = result.rows;
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const entries = discoveryRowsToEntries(page, baseUrl);

    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last ? `${last.org_slug}/${last.mcp_slug}` : null;

    return { entries, nextCursor };
  }
}

export async function createPostgresRegistryStore(
  options: PostgresRegistryStoreOptions,
): Promise<PostgresRegistryStore> {
  await options.pool.query('SELECT 1');
  const store = new PostgresRegistryStore(options);
  await store.ensureOrg(options.defaultOrgSlug);
  await store.ensureUser(options.defaultUserStubId);
  return store;
}
