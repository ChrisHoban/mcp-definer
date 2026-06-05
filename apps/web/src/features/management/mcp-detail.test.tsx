import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/context/AuthContext';

import { McpDetailPage } from './McpDetailPage';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      getMcp: vi.fn(),
      listVersions: vi.fn(),
      getVersion: vi.fn(),
      listAudit: vi.fn(),
      deprecateVersion: vi.fn(),
      createVersion: vi.fn(),
      regenerateVersion: vi.fn(),
    },
    discoveryApi: {
      getInstallSnippet: vi.fn(),
    },
  };
});

import { api, discoveryApi } from '@/lib/api-client';

const mockedApi = vi.mocked(api);
const mockedDiscovery = vi.mocked(discoveryApi);

function renderDetail(role = 'admin') {
  localStorage.setItem('mcp-definer-role', role);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={['/mcps/mcp_1']}>
          <Routes>
            <Route path="/mcps/:id" element={<McpDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('McpDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getMcp.mockResolvedValue({
      id: 'mcp_1',
      org: 'acme',
      slug: 'petstore',
      name: 'Petstore API',
      description: 'Demo',
      visibility: 'public',
      tags: ['pets'],
      status: 'published',
      latestVersionId: 'ver_1',
      latestVersion: { version: '1.0.0', channel: 'stable', publishedAt: '2026-01-01' },
    });
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
    mockedApi.getVersion.mockResolvedValue({
      id: 'ver_1',
      version: '1.0.0',
      channel: 'stable',
      publishedAt: '2026-01-01',
      deprecatedAt: null,
      manifest: { name: 'petstore', tools: [] } as never,
      tools: [],
      specText: null,
      curation: null,
      authorState: {},
    });
    mockedApi.listAudit.mockResolvedValue({ items: [] });
    mockedDiscovery.getInstallSnippet.mockResolvedValue({
      harness: 'cursor',
      snippet: { command: 'npx', args: ['-y', '@mcp-definer/runtime'], env: {} },
    });
  });

  it('renders MCP detail and install panel for admin', async () => {
    renderDetail('admin');
    expect(await screen.findByRole('heading', { name: 'Petstore API' })).toBeInTheDocument();
    expect((await screen.findAllByText(/@mcp-definer\/runtime/)).length).toBeGreaterThan(0);
  });

  it('hides deprecate for author role', async () => {
    renderDetail('author');
    expect(await screen.findByRole('heading', { name: 'Petstore API' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deprecate/i })).not.toBeInTheDocument();
  });
});
