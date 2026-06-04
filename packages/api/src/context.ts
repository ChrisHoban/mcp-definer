import {
  EnvCredentialResolver,
  EnvSecretStore,
  InMemoryBindingStore,
  PostgresBindingStore,
  type CredentialBindingStore,
  type OrgRole,
} from '@mcp-definer/auth';
import { createPool, runMigrations, validateDatabase, type DbPool } from '@mcp-definer/db';
import type { ManifestAuth } from '@mcp-definer/schemas';
import {
  createSeededRegistryStore,
  createPostgresRegistryStore,
  InMemoryRegistryStore,
  seedPetstoreFixture,
  type ControlPlaneRegistryStore,
  type RegistryContext,
} from '@mcp-definer/registry';

import type { ApiConfig } from './config.js';

export interface AuthContext {
  userId: string;
  orgId: string;
  orgSlug: string;
  role: OrgRole;
}

export interface ResolvedTenancy {
  orgId: string;
  userId: string;
  orgSlug: string;
}

export interface AppContext {
  config: ApiConfig;
  registryStore: ControlPlaneRegistryStore;
  registry: RegistryContext;
  tenancy: ResolvedTenancy;
  dbPool: DbPool | null;
  secretStore: EnvSecretStore;
  bindingStore: CredentialBindingStore;
  credentialResolver: EnvCredentialResolver;
  manifestAuthByBindingId: Map<string, ManifestAuth>;
}

export async function createAppContext(config: ApiConfig): Promise<AppContext> {
  let registryStore: ControlPlaneRegistryStore;
  let dbPool: DbPool | null = null;

  if (config.registryStore === 'postgres') {
    dbPool = createPool(config.databaseUrl);

    if (config.runMigrationsOnStartup) {
      await runMigrations(config.databaseUrl);
    }

    const health = await validateDatabase(dbPool);
    if (!health.ok) {
      await dbPool.end();
      throw new Error(`Database validation failed: ${health.error ?? 'unknown error'}`);
    }

    registryStore = await createPostgresRegistryStore({
      pool: dbPool,
      defaultOrgSlug: config.defaultOrgSlug,
      defaultUserStubId: config.defaultUserId,
    });

    if (config.mockMode) {
      const existing = await registryStore.getMcp(config.defaultOrgSlug, 'petstore');
      if (!existing) {
        await seedPetstoreFixture(registryStore, config.defaultUserId);
      }
    }
  } else if (config.mockMode) {
    registryStore = await createSeededRegistryStore();
  } else {
    registryStore = new InMemoryRegistryStore();
    await registryStore.ensureOrg(config.defaultOrgSlug);
  }

  const org = await registryStore.ensureOrg(config.defaultOrgSlug);
  const user = await registryStore.ensureUser(config.defaultUserId);

  const registry: RegistryContext = {
    store: registryStore,
    baseUrl: config.baseUrl,
  };

  const secretStore = new EnvSecretStore(process.env);
  const bindingStore: CredentialBindingStore = dbPool
    ? new PostgresBindingStore(dbPool, secretStore)
    : new InMemoryBindingStore(secretStore);
  const manifestAuthByBindingId = new Map<string, ManifestAuth>();
  const credentialResolver = new EnvCredentialResolver({
    bindingStore,
    secretStore,
    manifestAuthByBindingId,
  });

  return {
    config,
    registryStore,
    registry,
    tenancy: {
      orgId: org.id,
      userId: user.id,
      orgSlug: org.slug,
    },
    dbPool,
    secretStore,
    bindingStore,
    credentialResolver,
    manifestAuthByBindingId,
  };
}

export async function shutdownAppContext(ctx: AppContext): Promise<void> {
  if (ctx.registryStore.close) {
    await ctx.registryStore.close();
  } else if (ctx.dbPool) {
    await ctx.dbPool.end();
  }
}
