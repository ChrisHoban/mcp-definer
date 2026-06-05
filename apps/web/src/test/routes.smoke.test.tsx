import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/context/AuthContext';
import { AppRoutes } from '@/routes';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      parseSpec: vi.fn(),
      createMcp: vi.fn(),
      getVersion: vi.fn(),
      patchVersion: vi.fn(),
      validateVersion: vi.fn(),
      publishVersion: vi.fn(),
      getCredentials: vi.fn(),
      createCredentials: vi.fn(),
      listMcps: vi.fn(),
      getMcp: vi.fn(),
      deleteMcp: vi.fn(),
      listVersions: vi.fn(),
      deprecateVersion: vi.fn(),
      regenerateVersion: vi.fn(),
      createVersion: vi.fn(),
      invokeTool: vi.fn(),
      listAudit: vi.fn(),
    },
    discoveryApi: {
      getIndex: vi.fn(),
      search: vi.fn(),
      getRegistryDetail: vi.fn(),
      getInstallSnippet: vi.fn(),
    },
  };
});

import { api, discoveryApi } from '@/lib/api-client';

const mockedApi = vi.mocked(api);
const mockedDiscovery = vi.mocked(discoveryApi);

const mockMcp = {
  id: 'mcp_1',
  org: 'acme',
  slug: 'petstore',
  name: 'Petstore API',
  description: 'Demo MCP',
  visibility: 'public' as const,
  tags: ['pets'],
  status: 'published' as const,
  latestVersionId: 'ver_1',
  latestVersion: { version: '1.0.0', channel: 'stable' as const, publishedAt: '2026-01-01' },
};

const mockVersionDetail = {
  id: 'ver_1',
  version: '1.0.0',
  channel: 'stable' as const,
  publishedAt: '2026-01-01',
  deprecatedAt: null,
  manifest: {
    name: 'petstore',
    tools: [{ name: 'getPetById', enabled: true }],
  } as never,
  tools: [
    {
      name: 'getPetById',
      description: 'Fetch pet',
      enabled: true,
      group: 'pets',
      inputSchema: {
        type: 'object',
        properties: { petId: { type: 'integer' } },
        required: ['petId'],
      },
    } as never,
  ],
  specText: null,
  curation: null,
  authorState: {},
};

function setupMocks() {
  mockedApi.listMcps.mockResolvedValue({ items: [mockMcp], nextCursor: null });
  mockedApi.getMcp.mockResolvedValue(mockMcp);
  mockedApi.listVersions.mockResolvedValue({
    items: [
      {
        id: 'ver_1',
        version: '1.0.0',
        channel: 'stable',
        publishedAt: '2026-01-01',
        deprecatedAt: null,
      },
    ],
  });
  mockedApi.getVersion.mockResolvedValue(mockVersionDetail);
  mockedApi.getCredentials.mockResolvedValue({
    binding: {
      id: 'cb_1',
      mcpId: 'mcp_1',
      authType: 'apiKey',
      config: {},
      secretRef: 'vault://x',
      hasSecret: true,
    },
  });
  mockedApi.listAudit.mockResolvedValue({ items: [] });
  mockedDiscovery.getIndex.mockResolvedValue({
    indexVersion: '1.0',
    generatedAt: '2026-06-04T12:00:00Z',
    entries: [
      {
        org: 'acme',
        slug: 'petstore',
        name: 'Petstore API',
        description: 'Demo',
        visibility: 'public',
        latestVersion: '1.0.0',
        channel: 'stable',
        mcpProtocolVersion: '2024-11-05',
        toolCount: 1,
        toolNames: ['getPetById'],
        tags: ['pets'],
        installUrl: '/v1/registry/acme/petstore/install',
        manifestUrl: '/v1/registry/acme/petstore/versions/1.0.0/manifest',
      },
    ],
    nextCursor: null,
  });
  mockedDiscovery.search.mockResolvedValue({ entries: [], nextCursor: null });
  mockedDiscovery.getInstallSnippet.mockResolvedValue({
    harness: 'cursor',
    snippet: {
      command: 'npx',
      args: ['-y', '@mcp-definer/runtime', '--manifest', 'http://example/manifest'],
      env: {},
    },
  });
}

function renderAt(path: string, role = 'admin') {
  localStorage.setItem('mcp-definer-role', role);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('App route smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it.each([
    { path: '/', heading: 'MCP Catalog' },
    { path: '/mcps/new', heading: 'Create MCP' },
    { path: '/registry', heading: 'Registry' },
    { path: '/settings', heading: 'Settings' },
    { path: '/mcps/mcp_1', heading: 'Petstore API' },
    { path: '/mcps/mcp_1/test', heading: 'Test console' },
    { path: '/mcps/mcp_1/versions/1.0.0/edit', heading: 'Edit v1.0.0' },
  ])('renders $path', async ({ path, heading }) => {
    renderAt(path);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
