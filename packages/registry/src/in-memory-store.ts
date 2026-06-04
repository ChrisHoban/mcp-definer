import type { CurationProfile, Manifest } from '@mcp-definer/schemas';
import { MCP_PROTOCOL_VERSION } from '@mcp-definer/schemas';

import { RegistryError } from './errors.js';
import {
  id,
  installTargetsForVersion,
  manifestHash,
  sha256SpecHash,
  toolsFromManifest,
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
  StoredOrganization,
  StoredSourceSpec,
  StoredTool,
  UpdateDraftVersionInput,
  VersionAuthoringData,
} from './types.js';

export type { CreateMcpInput, ListMcpsFilter } from './types.js';

export class InMemoryRegistryStore implements ControlPlaneRegistryStore {
  private readonly orgs = new Map<string, StoredOrganization>();
  private readonly users = new Map<string, string>();
  private readonly mcps = new Map<string, StoredMcp>();
  private readonly mcpByOrgSlug = new Map<string, string>();
  private readonly versions = new Map<string, StoredMcpVersion>();
  private readonly versionsByMcp = new Map<string, StoredMcpVersion[]>();
  private readonly versionByMcpSemver = new Map<string, StoredMcpVersion>();
  private readonly manifests = new Map<string, StoredManifest>();
  private readonly tools = new Map<string, StoredTool[]>();
  private readonly installTargets = new Map<string, StoredInstallTarget[]>();
  private readonly sourceSpecs = new Map<string, StoredSourceSpec>();
  private readonly sourceSpecByVersion = new Map<string, string>();
  private readonly curations = new Map<string, CurationProfile>();
  private readonly authorStates = new Map<string, AuthorState>();
  private readonly auditEvents: AuditEvent[] = [];

  async ensureOrg(slug: string, name?: string): Promise<StoredOrganization> {
    const existing = this.orgs.get(slug);
    if (existing) {
      return existing;
    }
    const org: StoredOrganization = { id: id('org'), slug, name: name ?? slug };
    this.orgs.set(slug, org);
    return org;
  }

  async ensureUser(stubUserId: string, _displayName?: string): Promise<{ id: string }> {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(stubUserId)) {
      return { id: stubUserId };
    }

    const existing = this.users.get(stubUserId);
    if (existing) {
      return { id: existing };
    }
    const userId = id('user');
    this.users.set(stubUserId, userId);
    return { id: userId };
  }

  async createMcp(input: CreateMcpInput): Promise<{ mcp: StoredMcp; version: StoredMcpVersion }> {
    const org = await this.ensureOrg(input.org);
    const key = `${input.org}/${input.slug}`;
    if (this.mcpByOrgSlug.has(key)) {
      throw new RegistryError('CONFLICT', `MCP already exists: ${key}`);
    }

    const mcp: StoredMcp = {
      id: id('mcp'),
      orgId: org.id,
      orgSlug: input.org,
      slug: input.slug,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      latestVersionId: null,
      status: 'draft',
      ownerId: input.ownerId,
      tags: input.tags ?? [],
    };

    this.mcps.set(mcp.id, mcp);
    this.mcpByOrgSlug.set(key, mcp.id);

    const version = await this.createDraftVersionInternal({
      org: input.org,
      slug: input.slug,
      version: input.version,
      manifest: input.manifest,
      ownerId: input.ownerId,
      tags: input.tags,
      visibility: input.visibility,
      name: input.name,
      description: input.description,
      sourceSpec: input.sourceSpec,
      curation: input.curation,
      authorState: input.authorState,
    });

    return { mcp, version };
  }

  async listMcps(
    filter: ListMcpsFilter = {},
  ): Promise<{ items: StoredMcp[]; nextCursor: string | null }> {
    const limit = Math.min(filter.limit ?? 50, 100);
    let items = [...this.mcps.values()].filter((mcp) => mcp.status !== 'retired');

    if (filter.status) {
      items = items.filter((mcp) => mcp.status === filter.status);
    }
    if (filter.visibility) {
      items = items.filter((mcp) => mcp.visibility === filter.visibility);
    }
    if (filter.tag) {
      items = items.filter((mcp) => mcp.tags.includes(filter.tag!));
    }

    items.sort((a, b) => a.orgSlug.localeCompare(b.orgSlug) || a.slug.localeCompare(b.slug));

    let start = 0;
    if (filter.cursor) {
      const idx = items.findIndex((mcp) => mcp.id === filter.cursor);
      start = idx >= 0 ? idx + 1 : 0;
    }

    const page = items.slice(start, start + limit);
    const nextCursor = start + limit < items.length ? (page[page.length - 1]?.id ?? null) : null;

    return { items: page, nextCursor };
  }

  async updateMcp(
    mcpId: string,
    updates: Partial<Pick<StoredMcp, 'name' | 'description' | 'visibility' | 'tags'>>,
  ): Promise<StoredMcp> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) {
      throw new RegistryError('NOT_FOUND', `MCP not found: ${mcpId}`);
    }
    if (mcp.status === 'retired') {
      throw new RegistryError('NOT_FOUND', `MCP archived: ${mcpId}`);
    }

    const updated: StoredMcp = {
      ...mcp,
      name: updates.name ?? mcp.name,
      description: updates.description ?? mcp.description,
      visibility: updates.visibility ?? mcp.visibility,
      tags: updates.tags ?? mcp.tags,
    };
    this.mcps.set(mcpId, updated);
    return updated;
  }

  async archiveMcp(mcpId: string): Promise<StoredMcp> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp) {
      throw new RegistryError('NOT_FOUND', `MCP not found: ${mcpId}`);
    }
    const updated: StoredMcp = { ...mcp, status: 'retired' };
    this.mcps.set(mcpId, updated);
    return updated;
  }

  async listVersions(mcpId: string): Promise<StoredMcpVersion[]> {
    return [...(this.versionsByMcp.get(mcpId) ?? [])].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  async createDraftVersion(input: CreateDraftVersionInput): Promise<StoredMcpVersion> {
    return this.createDraftVersionInternal(input);
  }

  private getMcpSync(org: string, slug: string): StoredMcp | null {
    const mcpId = this.mcpByOrgSlug.get(`${org}/${slug}`);
    if (!mcpId) {
      return null;
    }
    return this.mcps.get(mcpId) ?? null;
  }

  private persistSourceSpec(mcpId: string, versionId: string, sourceSpec?: SourceSpecInput): void {
    if (!sourceSpec?.specText) {
      return;
    }
    const specId = id('spec');
    const stored: StoredSourceSpec = {
      id: specId,
      mcpId,
      specHash: sourceSpec.specHash ?? sha256SpecHash(sourceSpec.specText),
      specType: sourceSpec.specType,
      contentText: sourceSpec.specText,
    };
    this.sourceSpecs.set(specId, stored);
    this.sourceSpecByVersion.set(versionId, specId);
  }

  private persistCuration(versionId: string, curation?: CurationProfile): void {
    if (curation) {
      this.curations.set(versionId, curation);
    }
  }

  private persistAuthorState(versionId: string, authorState?: AuthorState): void {
    if (authorState) {
      this.authorStates.set(versionId, authorState);
    }
  }

  private createDraftVersionInternal(input: CreateDraftVersionInput): StoredMcpVersion {
    const mcp = this.getMcpSync(input.org, input.slug);
    if (!mcp) {
      throw new RegistryError('NOT_FOUND', `MCP not found: ${input.org}/${input.slug}`);
    }

    const semverKey = `${mcp.id}:${input.version}`;
    if (this.versionByMcpSemver.has(semverKey)) {
      throw new RegistryError('CONFLICT', `Version already exists: ${input.version}`);
    }

    const versionId = id('ver');
    const manifestId = id('mfst');
    const now = new Date().toISOString();

    const storedManifest: StoredManifest = {
      id: manifestId,
      content: input.manifest,
      contentHash: manifestHash(input.manifest),
      createdAt: now,
    };
    this.manifests.set(manifestId, storedManifest);

    const version: StoredMcpVersion = {
      id: versionId,
      mcpId: mcp.id,
      version: input.version,
      channel: 'draft',
      manifestId,
      mcpProtocolVersion: input.manifest.mcpProtocolVersion ?? MCP_PROTOCOL_VERSION,
      manifestSchemaVersion: input.manifest.manifestSchemaVersion,
      publishedAt: null,
      publishedBy: null,
      deprecatedAt: null,
      createdAt: now,
    };

    this.versions.set(versionId, version);
    this.versionByMcpSemver.set(semverKey, version);
    const list = this.versionsByMcp.get(mcp.id) ?? [];
    list.push(version);
    this.versionsByMcp.set(mcp.id, list);

    this.tools.set(versionId, toolsFromManifest(input.manifest, versionId));
    this.installTargets.set(versionId, installTargetsForVersion(versionId));
    this.persistSourceSpec(mcp.id, versionId, input.sourceSpec);
    this.persistCuration(versionId, input.curation);
    this.persistAuthorState(versionId, input.authorState);

    if (input.name || input.description || input.visibility || input.tags) {
      void this.updateMcp(mcp.id, {
        name: input.name,
        description: input.description,
        visibility: input.visibility,
        tags: input.tags,
      });
    }

    return version;
  }

  async getMcp(org: string, slug: string): Promise<StoredMcp | null> {
    const mcpId = this.mcpByOrgSlug.get(`${org}/${slug}`);
    if (!mcpId) {
      return null;
    }
    return this.mcps.get(mcpId) ?? null;
  }

  async getMcpById(mcpId: string): Promise<StoredMcp | null> {
    return this.mcps.get(mcpId) ?? null;
  }

  async getVersion(org: string, slug: string, version: string): Promise<StoredMcpVersion | null> {
    const mcp = await this.getMcp(org, slug);
    if (!mcp) {
      return null;
    }
    return this.versionByMcpSemver.get(`${mcp.id}:${version}`) ?? null;
  }

  async getVersionById(versionId: string): Promise<StoredMcpVersion | null> {
    return this.versions.get(versionId) ?? null;
  }

  async getVersionForMcp(mcpId: string, version: string): Promise<StoredMcpVersion | null> {
    return this.versionByMcpSemver.get(`${mcpId}:${version}`) ?? null;
  }

  async getManifestById(manifestId: string): Promise<StoredManifest | null> {
    return this.manifests.get(manifestId) ?? null;
  }

  async getToolsForVersion(versionId: string): Promise<StoredTool[]> {
    return this.tools.get(versionId) ?? [];
  }

  async getInstallTargets(versionId: string): Promise<StoredInstallTarget[]> {
    return this.installTargets.get(versionId) ?? [];
  }

  async getVersionAuthoringData(versionId: string): Promise<VersionAuthoringData> {
    const specId = this.sourceSpecByVersion.get(versionId);
    const sourceSpec = specId ? (this.sourceSpecs.get(specId) ?? null) : null;
    return {
      sourceSpec,
      curation: this.curations.get(versionId) ?? null,
      authorState: this.authorStates.get(versionId) ?? {},
    };
  }

  async publishVersion(
    versionId: string,
    channel: 'stable' | 'beta',
    actorId: string,
  ): Promise<StoredMcpVersion> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new RegistryError('NOT_FOUND', `Version not found: ${versionId}`);
    }
    if (version.publishedAt) {
      throw new RegistryError('ALREADY_PUBLISHED', `Version already published: ${version.version}`);
    }

    const now = new Date().toISOString();
    const updated: StoredMcpVersion = {
      ...version,
      channel,
      publishedAt: now,
      publishedBy: actorId,
    };
    this.versions.set(versionId, updated);
    this.versionByMcpSemver.set(`${version.mcpId}:${version.version}`, updated);

    const mcp = this.mcps.get(version.mcpId);
    if (mcp) {
      this.mcps.set(mcp.id, {
        ...mcp,
        status: 'published',
        latestVersionId: versionId,
      });
    }

    return updated;
  }

  async deprecateVersion(versionId: string, _actorId: string): Promise<StoredMcpVersion> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new RegistryError('NOT_FOUND', `Version not found: ${versionId}`);
    }
    if (!version.publishedAt) {
      throw new RegistryError('CONFLICT', 'Cannot deprecate an unpublished version');
    }

    const updated: StoredMcpVersion = {
      ...version,
      deprecatedAt: new Date().toISOString(),
    };
    this.versions.set(versionId, updated);
    this.versionByMcpSemver.set(`${version.mcpId}:${version.version}`, updated);
    return updated;
  }

  async updateDraftManifest(versionId: string, manifest: Manifest): Promise<StoredMcpVersion> {
    return this.updateDraftVersion(versionId, { manifest });
  }

  async updateDraftVersion(
    versionId: string,
    input: UpdateDraftVersionInput,
  ): Promise<StoredMcpVersion> {
    const version = this.versions.get(versionId);
    if (!version) {
      throw new RegistryError('NOT_FOUND', `Version not found: ${versionId}`);
    }
    if (version.publishedAt) {
      throw new RegistryError('IMMUTABLE', `Published version is immutable: ${version.version}`);
    }

    let manifestId = version.manifestId;
    if (input.manifest) {
      manifestId = id('mfst');
      const now = new Date().toISOString();
      this.manifests.set(manifestId, {
        id: manifestId,
        content: input.manifest,
        contentHash: manifestHash(input.manifest),
        createdAt: now,
      });
      this.tools.set(versionId, toolsFromManifest(input.manifest, versionId));
    }

    if (input.curation) {
      this.curations.set(versionId, input.curation);
    }

    if (input.authorState) {
      this.authorStates.set(versionId, input.authorState);
    }

    if (input.sourceSpec) {
      this.persistSourceSpec(version.mcpId, versionId, input.sourceSpec);
    }

    const manifest = input.manifest ?? (await this.getManifestById(manifestId))?.content;
    const updated: StoredMcpVersion = {
      ...version,
      manifestId,
      mcpProtocolVersion: manifest?.mcpProtocolVersion ?? MCP_PROTOCOL_VERSION,
      manifestSchemaVersion: manifest?.manifestSchemaVersion ?? version.manifestSchemaVersion,
    };
    this.versions.set(versionId, updated);
    this.versionByMcpSemver.set(`${version.mcpId}:${version.version}`, updated);

    return updated;
  }

  async listPublishedMcps(): Promise<StoredMcp[]> {
    return [...this.mcps.values()].filter(
      (mcp) => mcp.status === 'published' && mcp.latestVersionId !== null,
    );
  }

  async getLatestPublishedVersion(mcpId: string): Promise<StoredMcpVersion | null> {
    const mcp = this.mcps.get(mcpId);
    if (!mcp?.latestVersionId) {
      return null;
    }
    return this.versions.get(mcp.latestVersionId) ?? null;
  }

  async emitAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent> {
    const record: AuditEvent = {
      ...event,
      id: id('audit'),
      createdAt: new Date().toISOString(),
    };
    this.auditEvents.push(record);
    return record;
  }

  async listAuditEvents(orgId?: string): Promise<AuditEvent[]> {
    const events = [...this.auditEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!orgId) {
      return events;
    }
    return events.filter((e) => e.orgId === orgId);
  }
}
