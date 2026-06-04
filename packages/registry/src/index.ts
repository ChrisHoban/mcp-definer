import { InMemoryRegistryStore } from './in-memory-store.js';

export type {
  Visibility,
  Channel,
  Harness,
  McpRef,
  RegistryContext,
  PublishVersionInput,
  PublishVersionResult,
  DeprecateVersionInput,
  DiscoveryIndexEntry,
  DiscoveryIndexV1,
  SearchCatalogParams,
  SearchCatalogResult,
  VersionSummary,
  InstallTargetSummary,
  RegistryDetail,
  InstallSnippet,
  InstallSnippetTemplate,
  BuildIndexOptions,
  AuditEvent,
  StoredOrganization,
  StoredMcp,
  StoredManifest,
  StoredTool,
  StoredMcpVersion,
  StoredInstallTarget,
  CreateDraftVersionInput,
  RegistryStore,
  ControlPlaneRegistryStore,
  AuthorState,
  SourceSpecInput,
  VersionAuthoringData,
  UpdateDraftVersionInput,
} from './types.js';

export { RegistryError, type RegistryErrorCode } from './errors.js';
export {
  normalizeBaseUrl,
  manifestPath,
  installPath,
  manifestUrl,
  installUrl,
} from './urls.js';
export {
  buildInstallSnippet,
  buildInstallSnippetTemplate,
  resolveInstallSnippetTemplate,
  INSTALL_SNIPPET_PLACEHOLDER_MANIFEST,
  INSTALL_SNIPPET_PLACEHOLDER_SECRET,
  type BuildInstallSnippetOptions,
} from './install-snippet.js';
export { buildIndex } from './build-index.js';
export { publishVersion, updateDraftManifest } from './publish.js';
export { deprecateVersion, type DeprecateVersionResult } from './deprecate.js';
export { getRegistryDetail, fetchManifest, fetchManifest as getManifest } from './detail.js';
export { searchCatalog } from './search.js';
export {
  InMemoryRegistryStore,
  type CreateMcpInput,
  type ListMcpsFilter,
} from './in-memory-store.js';
export {
  PostgresRegistryStore,
  createPostgresRegistryStore,
  type PostgresRegistryStoreOptions,
} from './postgres-store.js';
export { createSeededRegistryStore, seedPetstoreFixture } from './seed.js';

/** Factory alias for A6 consumers expecting a function. */
export function createInMemoryRegistryStore(): InMemoryRegistryStore {
  return new InMemoryRegistryStore();
}
