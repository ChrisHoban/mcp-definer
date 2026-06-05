import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ApiError } from '@/lib/api-client';
import { defaultWizardMeta, mockPetIr } from '@/test/wizard-fixtures';

import { EditWizardPage } from './EditWizardPage';

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  api: {
    getVersion: vi.fn(),
    parseSpec: vi.fn(),
    patchVersion: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

const mockedGetVersion = vi.mocked(api.getVersion);
const mockedParseSpec = vi.mocked(api.parseSpec);
const mockedPatchVersion = vi.mocked(api.patchVersion);

const versionDetail = {
  id: 'ver_1',
  version: '1.0.0',
  channel: 'stable' as const,
  publishedAt: null,
  deprecatedAt: null,
  manifest: {
    name: defaultWizardMeta.slug,
    displayName: defaultWizardMeta.name,
    description: defaultWizardMeta.description,
    tools: [],
  },
  tools: [],
  specText: 'openapi: 3.0.0',
  curation: null,
  authorState: { wizardStep: 'curate' as const },
};

function renderEditRoute(path = '/mcps/mcp_1/versions/1.0.0/edit') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/mcps/:id/versions/:ver/edit" element={<EditWizardPage />} />
          <Route path="/broken" element={<EditWizardPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('EditWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPatchVersion.mockResolvedValue({} as never);
    mockedGetVersion.mockResolvedValue(versionDetail);
    mockedParseSpec.mockResolvedValue({
      ir: mockPetIr,
      specText: 'openapi: 3.0.0',
      warnings: [],
    });
  });

  it('shows missing route params error', () => {
    renderEditRoute('/broken');
    expect(screen.getByText(/Missing MCP id or version/i)).toBeInTheDocument();
  });

  it('hydrates draft version and renders edit shell', async () => {
    renderEditRoute();
    expect(await screen.findByRole('heading', { name: /Edit v1\.0\.0/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /Curate tools/i })).toBeInTheDocument();
    await waitFor(() => expect(mockedParseSpec).toHaveBeenCalled());
  });

  it('shows API error when version load fails', async () => {
    mockedGetVersion.mockRejectedValue(new ApiError('Version not found', 404));
    renderEditRoute();
    expect(await screen.findByText(/Version not found/i)).toBeInTheDocument();
  });

  it('shows parse error when spec restore fails', async () => {
    mockedParseSpec.mockRejectedValue(new ApiError('Invalid OpenAPI', 422));
    renderEditRoute();
    expect(await screen.findByText(/Invalid OpenAPI/i)).toBeInTheDocument();
  });
});
