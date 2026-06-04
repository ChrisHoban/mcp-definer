import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/context/AuthContext';

import { RegenerateDiffView } from './components/RegenerateDiffView';
import { McpListPage } from './McpListPage';
import { SettingsPage } from './SettingsPage';
import { TestConsolePage } from './TestConsolePage';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      listMcps: vi.fn(),
      getMcp: vi.fn(),
      listVersions: vi.fn(),
      getVersion: vi.fn(),
      getCredentials: vi.fn(),
      invokeTool: vi.fn(),
    },
    discoveryApi: {
      getIndex: vi.fn(),
      search: vi.fn(),
      getInstallSnippet: vi.fn(),
    },
  };
});

import { api } from '@/lib/api-client';

const mockedApi = vi.mocked(api);

function renderWithProviders(
  ui: React.ReactElement,
  role?: string,
  initialEntries: string[] = ['/'],
) {
  if (role) {
    localStorage.setItem('mcp-definer-role', role);
  } else {
    localStorage.removeItem('mcp-definer-role');
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider key={role ?? 'default'}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('RegenerateDiffView', () => {
  it('renders added, removed, and changed tools', () => {
    render(
      <RegenerateDiffView
        diff={{
          added: [{ operationId: 'op1', toolName: 'newTool', fields: ['name'] }],
          removed: [{ operationId: 'op2', toolName: 'oldTool', fields: [] }],
          changed: [
            {
              operationId: 'op3',
              toolName: 'getPetById',
              fields: ['description', 'inputSchema'],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText(/Added tools/)).toBeInTheDocument();
    expect(screen.getByText('newTool')).toBeInTheDocument();
    expect(screen.getByText('oldTool')).toBeInTheDocument();
    expect(screen.getByText(/getPetById/)).toBeInTheDocument();
  });
});

describe('McpListPage RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listMcps.mockResolvedValue({
      items: [
        {
          id: 'mcp_1',
          org: 'acme',
          slug: 'petstore',
          name: 'Petstore API',
          description: 'Demo',
          visibility: 'public',
          tags: ['pets'],
          status: 'published',
          latestVersionId: 'ver_1',
        },
      ],
      nextCursor: null,
    });
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
  });

  it('hides Create MCP for viewer role', async () => {
    renderWithProviders(<McpListPage />, 'viewer');

    expect(await screen.findByText('Petstore API')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create MCP/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archive/i })).not.toBeInTheDocument();
  });

  it('shows edit but not deprecate for author role', async () => {
    renderWithProviders(<McpListPage />, 'author');

    expect(await screen.findByText('Petstore API')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create MCP/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Deprecate/i })).not.toBeInTheDocument();
  });

  it('shows deprecate for admin role', async () => {
    renderWithProviders(<McpListPage />, 'admin');

    expect(await screen.findByText('Petstore API')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deprecate/i })).toBeInTheDocument();
  });
});

describe('TestConsolePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks viewer from test console', () => {
    renderWithProviders(
      <Routes>
        <Route path="/mcps/:id/test" element={<TestConsolePage />} />
      </Routes>,
      'viewer',
      ['/mcps/mcp_1/test'],
    );

    expect(screen.getByText(/does not have permission to invoke/i)).toBeInTheDocument();
  });

  it('renders tool picker for author when data loads', async () => {
    mockedApi.getMcp.mockResolvedValue({
      id: 'mcp_1',
      org: 'acme',
      slug: 'petstore',
      name: 'Petstore API',
      description: 'Demo',
      visibility: 'public',
      tags: [],
      status: 'published',
      latestVersionId: 'ver_1',
      latestVersion: { version: '1.0.0', channel: 'stable', publishedAt: '2026-01-01' },
    });
    mockedApi.getVersion.mockResolvedValue({
      id: 'ver_1',
      version: '1.0.0',
      channel: 'stable',
      publishedAt: '2026-01-01',
      deprecatedAt: null,
      manifest: {} as never,
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
    });
    mockedApi.getCredentials.mockResolvedValue({
      binding: { id: 'cb_1', mcpId: 'mcp_1', authType: 'apiKey', config: {}, secretRef: 'vault://x', hasSecret: true },
    });

    renderWithProviders(
      <Routes>
        <Route path="/mcps/:id/test" element={<TestConsolePage />} />
      </Routes>,
      'author',
      ['/mcps/mcp_1/test'],
    );

    expect(await screen.findByRole('option', { name: /getPetById/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Invoke/i })).toBeEnabled();
  });
});

describe('SettingsPage', () => {
  it('allows changing dev role', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SettingsPage />, 'viewer');

    const select = screen.getByLabelText(/Role/i);
    await user.selectOptions(select, 'admin');

    expect(select).toHaveValue('admin');
  });
});
