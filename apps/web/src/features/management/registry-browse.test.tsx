import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/context/AuthContext';

import { RegistryBrowsePage } from './RegistryBrowsePage';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    discoveryApi: {
      getIndex: vi.fn(),
      search: vi.fn(),
      getRegistryDetail: vi.fn(),
      getInstallSnippet: vi.fn(),
    },
  };
});

import { discoveryApi } from '@/lib/api-client';

const mockedDiscovery = vi.mocked(discoveryApi);

const entry = {
  org: 'acme',
  slug: 'petstore',
  name: 'Petstore API',
  description: 'Demo catalog entry',
  visibility: 'public' as const,
  latestVersion: '1.0.0',
  channel: 'stable',
  mcpProtocolVersion: '2024-11-05',
  toolCount: 1,
  toolNames: ['getPetById'],
  tags: ['pets'],
  installUrl: '/v1/registry/acme/petstore/install',
  manifestUrl: '/v1/registry/acme/petstore/versions/1.0.0/manifest',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <RegistryBrowsePage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('RegistryBrowsePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDiscovery.getIndex.mockResolvedValue({
      indexVersion: '1.0',
      generatedAt: '2026-06-04T12:00:00Z',
      entries: [entry],
      nextCursor: null,
    });
    mockedDiscovery.search.mockResolvedValue({ entries: [entry], nextCursor: null });
    mockedDiscovery.getInstallSnippet.mockResolvedValue({
      harness: 'cursor',
      snippet: { command: 'npx', args: ['-y', '@mcp-definer/runtime'], env: {} },
    });
  });

  it('renders catalog entries from index', async () => {
    renderPage();
    expect(await screen.findByText('Petstore API')).toBeInTheDocument();
    expect(screen.getByText(/Demo catalog entry/)).toBeInTheDocument();
  });

  it('searches catalog when query is entered', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Search registry/i), 'pet');
    await waitFor(() => expect(mockedDiscovery.search).toHaveBeenCalled());
    expect(await screen.findByText('Petstore API')).toBeInTheDocument();
  });
});
