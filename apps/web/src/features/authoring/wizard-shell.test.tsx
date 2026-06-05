import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultWizardMeta, mockPetIr } from '@/test/wizard-fixtures';

import { WizardProvider, useWizard } from './WizardContext';
import { WizardShell } from './WizardShell';
import type { WizardStepId } from './wizard-types';

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status = 400;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  api: {
    createMcp: vi.fn(),
    patchVersion: vi.fn(),
  },
}));

import { api, ApiError } from '@/lib/api-client';

const mockedCreateMcp = vi.mocked(api.createMcp);
const mockedPatchVersion = vi.mocked(api.patchVersion);

function SeedWizard({
  step = 'import',
  mcpId,
}: {
  step?: WizardStepId;
  mcpId?: string;
}) {
  const { setIr, setMeta, setSpecText, setStep, setMcpId } = useWizard();
  useEffect(() => {
    setIr(mockPetIr);
    setMeta(defaultWizardMeta);
    setSpecText('openapi: 2.0');
    setStep(step);
    if (mcpId) {
      setMcpId(mcpId);
    }
  }, [setIr, setMeta, setSpecText, setStep, setMcpId, step, mcpId]);
  return null;
}

function renderShell(opts?: { step?: WizardStepId; mcpId?: string; mode?: 'create' | 'edit' }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider mode={opts?.mode ?? 'create'} initialMcpId={opts?.mcpId}>
        <SeedWizard step={opts?.step} mcpId={opts?.mcpId} />
        <WizardShell title="Create MCP" />
      </WizardProvider>
    </QueryClientProvider>,
  );
}

describe('WizardShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateMcp.mockResolvedValue({
      id: 'mcp_new',
      org: 'default',
      slug: 'petstore',
      name: 'Petstore',
      description: 'Test API',
      visibility: 'private',
      tags: [],
      status: 'draft',
      latestVersionId: null,
      draftVersion: '0.1.0',
    });
    mockedPatchVersion.mockResolvedValue({} as never);
  });

  it('navigates to curate step via stepper when IR is loaded', async () => {
    const user = userEvent.setup();
    renderShell({ step: 'import' });

    await screen.findByRole('heading', { name: /Import OpenAPI spec/i });
    await user.click(screen.getByRole('button', { name: /Curate tools/i }));

    expect(await screen.findByRole('heading', { name: /Curate tools/i })).toBeInTheDocument();
  });

  it('creates MCP on first save draft from curate step', async () => {
    const user = userEvent.setup();
    renderShell({ step: 'curate' });

    await screen.findByRole('heading', { name: /Curate tools/i });
    await user.click(screen.getByRole('button', { name: /Save draft & continue/i }));

    await waitFor(() => expect(mockedCreateMcp).toHaveBeenCalled());
    expect(mockedCreateMcp).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'petstore',
        version: '0.1.0',
      }),
    );
    await waitFor(() =>
      expect(screen.getByText(/mcp_new · v0\.1\.0/)).toBeInTheDocument(),
    );
  });

  it('patches version when MCP already exists', async () => {
    const user = userEvent.setup();
    renderShell({ step: 'curate', mcpId: 'mcp_existing', mode: 'edit' });

    await screen.findByRole('heading', { name: /Curate tools/i });
    await user.click(screen.getByRole('button', { name: /Save draft & continue/i }));

    await waitFor(() =>
      expect(mockedPatchVersion).toHaveBeenCalledWith(
        'mcp_existing',
        '0.1.0',
        expect.objectContaining({
          manifest: expect.any(Object),
          curation: expect.any(Object),
        }),
      ),
    );
    expect(mockedCreateMcp).not.toHaveBeenCalled();
  });

  it('shows conflict error when save hits published immutable version', async () => {
    const user = userEvent.setup();
    mockedPatchVersion.mockRejectedValue(new ApiError('Conflict', 409));
    renderShell({ step: 'curate', mcpId: 'mcp_locked', mode: 'edit' });

    await screen.findByRole('heading', { name: /Curate tools/i });
    await user.click(screen.getByRole('button', { name: /Save draft & continue/i }));

    expect(
      await screen.findByText(/published and immutable/i),
    ).toBeInTheDocument();
  });

  it('persists author state after step change debounce', async () => {
    vi.useFakeTimers();
    try {
      renderShell({ step: 'import', mcpId: 'mcp_draft' });
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(mockedPatchVersion).toHaveBeenCalledWith(
        'mcp_draft',
        '0.1.0',
        expect.objectContaining({
          authorState: expect.objectContaining({ wizardStep: 'import' }),
        }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
