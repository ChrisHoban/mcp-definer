import type { CurationProfile, Manifest } from '@mcp-definer/schemas';

export type Visibility = 'private' | 'org' | 'public';
export type Channel = 'draft' | 'stable' | 'beta';
export type Harness = 'cursor' | 'claude-desktop' | 'generic';

export interface McpRef {
  org: string;
  slug: string;
}

export interface RegistryContext {
  store: RegistryStore;
  /** Path prefix for registry URLs, e.g. `/v1` or `https://registry.example.com/v1`. */
  baseUrl?: string;
}

export interface PublishVersionInput {
  org: string;
  slug: string;
  /** Draft version semver to publish. */
  version: string;
  channel: 'stable' | 'beta';
  actorId: string;
}

export interface PublishVersionResult {
  org: string;
  slug: string;
  version: string;
  channel: 'stable' | 'beta';
  publishedAt: string;
  manifestUrl: string;
}

export interface DeprecateVersionInput {
  org: string;
  slug: string;
  version: string;
  actorId: string;
  reason?: string;
}

export interface DiscoveryIndexEntry {
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: Visibility;
  latestVersion: string;
  channel: string;
  mcpProtocolVersion: string;
  toolCount: number;
  toolNames: string[];
  tags: string[];
  installUrl: string;
  manifestUrl: string;
}

export interface DiscoveryIndexV1 {
  indexVersion: '1.0';
  generatedAt: string;
  entries: DiscoveryIndexEntry[];
  nextCursor: string | null;
}

export interface SearchCatalogParams {
  query?: string;
  tags?: string[];
  /** Filter by tool name (capability). */
  capability?: string;
  visibility?: Visibility;
  channel?: Channel;
  cursor?: string;
  limit?: number;
}

export interface SearchCatalogResult {
  entries: DiscoveryIndexEntry[];
  nextCursor: string | null;
}

export interface VersionSummary {
  version: string;
  channel: Channel;
  publishedAt: string | null;
  deprecatedAt: string | null;
  mcpProtocolVersion: string;
  manifestSchemaVersion: string;
  toolCount: number;
}

export interface InstallTargetSummary {
  harness: Harness;
  transport: 'stdio' | 'http';
  configSnippet: InstallSnippetTemplate;
  instructions: string;
}

export interface RegistryDetail {
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: Visibility;
  tags: string[];
  latestVersion: string | null;
  versions: VersionSummary[];
  installTargets: InstallTargetSummary[];
}

/** Resolved Cursor/harness config (placeholders replaced). */
export interface InstallSnippet {
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** Stored template with ADR-008 placeholders. */
export interface InstallSnippetTemplate {
  command: string;
  args: string[];
  env: Record<string, string>;
}

export interface BuildIndexOptions {
  cursor?: string;
  limit?: number;
  /** Override for deterministic tests. */
  generatedAt?: string;
}

export interface ListDiscoveryIndexOptions {
  limit: number;
  cursor?: string;
  /** Public API base URL for install/manifest links. */
  baseUrl?: string;
}

/** Postgres-backed catalog reads from the materialized discovery_index view (DR-06). */
export interface DiscoveryIndexReader {
  listDiscoveryIndexEntries(
    options: ListDiscoveryIndexOptions,
  ): Promise<{ entries: DiscoveryIndexEntry[]; nextCursor: string | null }>;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Store types (internal persistence model)
// ---------------------------------------------------------------------------

export interface StoredOrganization {
  id: string;
  slug: string;
  name: string;
}

export interface StoredMcp {
  id: string;
  orgId: string;
  orgSlug: string;
  slug: string;
  name: string;
  description: string;
  visibility: Visibility;
  latestVersionId: string | null;
  status: 'draft' | 'published' | 'deprecated' | 'retired';
  ownerId: string;
  tags: string[];
}

export interface StoredManifest {
  id: string;
  content: Manifest;
  contentHash: string;
  createdAt: string;
}

export interface StoredTool {
  id: string;
  mcpVersionId: string;
  name: string;
  description: string;
  enabled: boolean;
  tags: string[];
}

export interface StoredMcpVersion {
  id: string;
  mcpId: string;
  version: string;
  channel: Channel;
  manifestId: string;
  mcpProtocolVersion: string;
  manifestSchemaVersion: string;
  publishedAt: string | null;
  publishedBy: string | null;
  deprecatedAt: string | null;
  createdAt: string;
}

export interface StoredInstallTarget {
  id: string;
  mcpVersionId: string;
  harness: Harness;
  transport: 'stdio' | 'http';
  configSnippet: InstallSnippetTemplate;
  instructions: string;
}

export interface CreateDraftVersionInput {
  org: string;
  slug: string;
  version: string;
  manifest: Manifest;
  ownerId: string;
  tags?: string[];
  visibility?: Visibility;
  name?: string;
  description?: string;
  sourceSpec?: SourceSpecInput;
  curation?: CurationProfile;
  authorState?: AuthorState;
}

/** Wizard authoring progress persisted with a draft version. */
export interface AuthorState {
  wizardStep?: string;
  parseWarnings?: { code: string; message: string }[];
}

export interface SourceSpecInput {
  specText: string;
  specType: string;
  specHash?: string;
}

export interface StoredSourceSpec {
  id: string;
  mcpId: string;
  specHash: string;
  specType: string;
  contentText: string;
}

export interface VersionAuthoringData {
  sourceSpec: StoredSourceSpec | null;
  curation: CurationProfile | null;
  authorState: AuthorState;
}

export interface UpdateDraftVersionInput {
  manifest?: Manifest;
  curation?: CurationProfile;
  authorState?: AuthorState;
  sourceSpec?: SourceSpecInput;
}

export interface RegistryStore {
  createDraftVersion(input: CreateDraftVersionInput): Promise<StoredMcpVersion>;
  listVersions?(mcpId: string): Promise<StoredMcpVersion[]> | StoredMcpVersion[];
  getMcp(org: string, slug: string): Promise<StoredMcp | null>;
  getVersion(org: string, slug: string, version: string): Promise<StoredMcpVersion | null>;
  getManifestById(manifestId: string): Promise<StoredManifest | null>;
  getToolsForVersion(versionId: string): Promise<StoredTool[]>;
  getInstallTargets(versionId: string): Promise<StoredInstallTarget[]>;
  getVersionAuthoringData(versionId: string): Promise<VersionAuthoringData>;
  publishVersion(
    versionId: string,
    channel: 'stable' | 'beta',
    actorId: string,
  ): Promise<StoredMcpVersion>;
  deprecateVersion(versionId: string, actorId: string): Promise<StoredMcpVersion>;
  updateDraftManifest(versionId: string, manifest: Manifest): Promise<StoredMcpVersion>;
  updateDraftVersion(versionId: string, input: UpdateDraftVersionInput): Promise<StoredMcpVersion>;
  listPublishedMcps(): Promise<StoredMcp[]>;
  getLatestPublishedVersion(mcpId: string): Promise<StoredMcpVersion | null>;
  emitAuditEvent(event: Omit<AuditEvent, 'id' | 'createdAt'>): Promise<AuditEvent>;
  listAuditEvents(orgId?: string): Promise<AuditEvent[]>;
}

/** Control-plane store surface used by the HTTP API. */
export interface ControlPlaneRegistryStore extends RegistryStore {
  listVersions(mcpId: string): Promise<StoredMcpVersion[]>;
  ensureOrg(slug: string, name?: string): Promise<StoredOrganization>;
  ensureUser(stubUserId: string, displayName?: string): Promise<{ id: string }>;
  createMcp(input: CreateMcpInput): Promise<{ mcp: StoredMcp; version: StoredMcpVersion }>;
  listMcps(filter?: ListMcpsFilter): Promise<{ items: StoredMcp[]; nextCursor: string | null }>;
  updateMcp(
    mcpId: string,
    updates: Partial<Pick<StoredMcp, 'name' | 'description' | 'visibility' | 'tags'>>,
  ): Promise<StoredMcp>;
  archiveMcp(mcpId: string): Promise<StoredMcp>;
  getMcpById(mcpId: string): Promise<StoredMcp | null>;
  getVersionById(versionId: string): Promise<StoredMcpVersion | null>;
  getVersionForMcp(mcpId: string, version: string): Promise<StoredMcpVersion | null>;
  close?(): Promise<void>;
}

export interface CreateMcpInput {
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: StoredMcp['visibility'];
  ownerId: string;
  tags?: string[];
  manifest: Manifest;
  version: string;
  sourceSpec?: SourceSpecInput;
  curation?: CurationProfile;
  authorState?: AuthorState;
}

export interface ListMcpsFilter {
  status?: StoredMcp['status'];
  visibility?: StoredMcp['visibility'];
  tag?: string;
  cursor?: string;
  limit?: number;
}
