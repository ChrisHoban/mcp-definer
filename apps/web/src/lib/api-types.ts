import type { CredentialBindingPublic } from '@mcp-definer/auth';
import type {
  CurationProfile,
  IntermediateRepresentation,
  Manifest,
  ManifestAuthType,
  ManifestTool,
} from '@mcp-definer/schemas';

export interface ApiProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  code?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public problem?: ApiProblem,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ParseSpecResponse {
  ir: IntermediateRepresentation;
  format: string;
  warnings: { code: string; message: string }[];
  operationCount: number;
  specText: string;
}

export interface CreateMcpResponse {
  id: string;
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: string;
  tags: string[];
  status: string;
  latestVersionId: string | null;
  draftVersion: string;
}

export interface VersionDetailResponse {
  id: string;
  version: string;
  channel: string | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
  manifest: Manifest;
  tools: ManifestTool[];
  specText: string | null;
  curation: CurationProfile | null;
  authorState: AuthorState;
}

export interface AuthorState {
  wizardStep?: string;
  parseWarnings?: { code: string; message: string }[];
}

export interface ValidationResponse {
  valid: boolean;
  errors: { path?: string; message: string; code?: string }[];
  warnings: { path?: string; message: string; code?: string }[];
}

export interface PublishResponse {
  version: string;
  channel: string;
  publishedAt: string;
  manifestUrl?: string;
}

export interface CredentialResponse {
  binding: CredentialBindingPublic | null;
}

export interface CreateCredentialRequest {
  id: string;
  authType: ManifestAuthType;
  config?: Record<string, unknown>;
  secret: string;
}

export interface CreateMcpRequest {
  org?: string;
  slug: string;
  name: string;
  description?: string;
  visibility?: 'private' | 'org' | 'public';
  tags?: string[];
  ir: IntermediateRepresentation;
  curation?: CurationProfile;
  version?: string;
  specText?: string;
  authorState?: AuthorState;
}

export interface PatchVersionRequest {
  manifest?: Manifest;
  curation?: CurationProfile;
  authorState?: AuthorState;
  specText?: string;
  specType?: string;
  specHash?: string;
}

// --- Management & discovery (A8) ---

export interface McpSummary {
  id: string;
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'private' | 'org' | 'public';
  tags: string[];
  status: 'draft' | 'published' | 'deprecated' | 'retired';
  latestVersionId: string | null;
}

export interface McpListResponse {
  items: McpSummary[];
  nextCursor: string | null;
}

export interface McpDetailResponse extends McpSummary {
  latestVersion: {
    version: string;
    channel: string | null;
    publishedAt: string | null;
  } | null;
}

export interface VersionListItem {
  id: string;
  version: string;
  channel: string | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
}

export interface VersionListResponse {
  items: VersionListItem[];
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

export interface AuditListResponse {
  items: AuditEvent[];
}

export interface ToolChangeDetail {
  operationId: string;
  toolName: string;
  fields: Array<'description' | 'inputSchema' | 'request' | 'response' | 'group' | 'enabled' | 'name'>;
}

export interface ManifestDiff {
  added: ToolChangeDetail[];
  removed: ToolChangeDetail[];
  changed: ToolChangeDetail[];
}

export interface RegenerateResponse {
  manifest: Manifest;
  diff: ManifestDiff;
  warnings: { code: string; message: string }[];
}

export interface InvokeToolResponse {
  result: unknown;
  requestLog: Record<string, unknown>[];
}

export interface DiscoveryIndexEntry {
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'private' | 'org' | 'public';
  latestVersion: string;
  channel: string;
  mcpProtocolVersion: string;
  toolCount: number;
  toolNames: string[];
  tags: string[];
  installUrl: string;
  manifestUrl: string;
}

export interface DiscoveryIndexResponse {
  indexVersion: string;
  generatedAt: string;
  entries: DiscoveryIndexEntry[];
  nextCursor: string | null;
}

export interface SearchCatalogResponse {
  entries: DiscoveryIndexEntry[];
  nextCursor: string | null;
}

export interface RegistryDetailResponse {
  org: string;
  slug: string;
  name: string;
  description: string;
  visibility: 'private' | 'org' | 'public';
  tags: string[];
  latestVersion: string | null;
  versions: {
    version: string;
    channel: string;
    publishedAt: string | null;
    deprecatedAt: string | null;
    mcpProtocolVersion: string;
    manifestSchemaVersion: string;
    toolCount: number;
  }[];
  installTargets: {
    harness: string;
    transport: string;
    configSnippet: { command: string; args: string[]; env: Record<string, string> };
    instructions: string;
  }[];
}

export interface InstallSnippetResponse {
  harness: string;
  snippet: {
    command: string;
    args: string[];
    env: Record<string, string>;
  };
}
