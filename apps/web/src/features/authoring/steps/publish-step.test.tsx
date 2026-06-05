import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/context/AuthContext';
import { WizardProvider, useWizard } from '../WizardContext';
import { PublishStep } from './PublishStep';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      publishVersion: vi.fn(),
    },
  };
});

import { api, ApiError } from '@/lib/api-client';

const mockedPublish = vi.mocked(api.publishVersion);

function SeedPublishWizard({
  validationValid = true,
  published = false,
}: {
  validationValid?: boolean;
  published?: boolean;
}) {
  const { setValidation, setPublish } = useWizard();
  useEffect(() => {
    setValidation({
      valid: validationValid,
      errors: [],
      warnings: [],
      lastCheckedAt: new Date().toISOString(),
    });
    if (published) {
      setPublish((p) => ({ ...p, published: true, publishedAt: '2026-01-01T00:00:00Z' }));
    }
  }, [setValidation, setPublish, validationValid, published]);
  return null;
}

function renderPublishStep(opts?: {
  role?: 'admin' | 'viewer';
  validationValid?: boolean;
  initialPublished?: boolean;
  publishDone?: boolean;
}) {
  localStorage.setItem('mcp-definer-role', opts?.role ?? 'admin');
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <WizardProvider
            mode="create"
            initialMcpId="mcp_pub"
            initialPublished={opts?.initialPublished}
          >
            <SeedPublishWizard
              validationValid={opts?.validationValid ?? true}
              published={opts?.publishDone}
            />
            <PublishStep onBack={vi.fn()} />
          </WizardProvider>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('PublishStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedPublish.mockResolvedValue({
      version: '0.1.0',
      channel: 'stable',
      publishedAt: '2026-06-04T12:00:00Z',
    });
  });

  it('blocks publish when validation has not passed', () => {
    renderPublishStep({ validationValid: false });
    expect(screen.getByText(/Run validation and fix all errors/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish v0\.1\.0/i })).toBeDisabled();
  });

  it('blocks publish for viewers without mcp:publish', () => {
    renderPublishStep({ role: 'viewer' });
    expect(screen.getByText(/does not have publish permission/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish v0\.1\.0/i })).toBeDisabled();
  });

  it('publishes version when admin and validation passed', async () => {
    const user = userEvent.setup();
    renderPublishStep();

    await user.type(screen.getByLabelText(/Changelog/i), 'Initial public release');
    await user.click(screen.getByRole('button', { name: /Publish v0\.1\.0/i }));

    await waitFor(() =>
      expect(mockedPublish).toHaveBeenCalledWith('mcp_pub', '0.1.0', {
        channel: 'stable',
        changelog: 'Initial public release',
      }),
    );
    expect(await screen.findByText(/Published v0\.1\.0/i)).toBeInTheDocument();
  });

  it('shows publish API errors', async () => {
    const user = userEvent.setup();
    mockedPublish.mockRejectedValue(new ApiError('Version conflict', 409));
    renderPublishStep();

    await user.click(screen.getByRole('button', { name: /Publish v0\.1\.0/i }));
    expect(await screen.findByText(/Version conflict/i)).toBeInTheDocument();
  });

  it('shows immutable message when version was already published', () => {
    renderPublishStep({ initialPublished: true });
    expect(screen.getByText(/already published and immutable/i)).toBeInTheDocument();
  });

  it('shows success state after publish completes in-session', () => {
    renderPublishStep({ publishDone: true });
    expect(screen.getByText(/Published v0\.1\.0 to stable/i)).toBeInTheDocument();
  });
});
