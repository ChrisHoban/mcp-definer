import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

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

import { api } from '@/lib/api-client';

const mockedApi = vi.mocked(api);

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('mcp-definer-role', 'admin');
    mockedApi.listMcps.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('renders the catalog route inside the app shell', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'MCP Catalog' })).toBeInTheDocument();
  });
});
