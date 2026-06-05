import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '../WizardContext';
import { AuthStep } from './AuthStep';

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status = 400;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
  api: {
    getCredentials: vi.fn(),
    createCredentials: vi.fn(),
  },
}));

import { api, ApiError } from '@/lib/api-client';

const mockedGetCredentials = vi.mocked(api.getCredentials);
const mockedCreateCredentials = vi.mocked(api.createCredentials);

const existingBinding = {
  id: 'cb_existing',
  mcpId: 'mcp_petstore',
  authType: 'apiKey' as const,
  config: { in: 'header', name: 'X-Api-Key' },
  hasSecret: true,
  secretRef: 'env:EXISTING',
};

function renderAuthStep(
  mcpId: string | null = 'mcp_petstore',
  opts?: { prefilledBinding?: boolean },
) {
  const onNext = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  if (mcpId && opts?.prefilledBinding) {
    queryClient.setQueryData(['credentials', mcpId], { binding: existingBinding });
  }

  render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider mode="create" initialMcpId={mcpId ?? undefined}>
        <AuthStep onNext={onNext} onBack={vi.fn()} />
      </WizardProvider>
    </QueryClientProvider>,
  );

  return { onNext, queryClient };
}

describe('AuthStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetCredentials.mockResolvedValue({ binding: null });
  });

  it('warns when MCP id is missing', () => {
    renderAuthStep(null);
    expect(screen.getByText(/Save the draft MCP first/i)).toBeInTheDocument();
  });

  it('requires a secret when none is configured', async () => {
    const user = userEvent.setup();
    renderAuthStep();

    await screen.findByRole('heading', { name: /Configure authentication/i });
    await user.click(screen.getByRole('button', { name: /Save & continue/i }));

    expect(await screen.findByText(/Enter a secret value/i)).toBeInTheDocument();
    expect(mockedCreateCredentials).not.toHaveBeenCalled();
  });

  it('creates credentials and advances when secret is provided', async () => {
    const user = userEvent.setup();
    const { onNext } = renderAuthStep();

    mockedCreateCredentials.mockResolvedValue({
      binding: {
        id: 'cb_petstore',
        authType: 'apiKey',
        config: { in: 'header', name: 'api_key' },
        hasSecret: true,
        secretRef: 'env:PET_KEY',
      },
    });

    await screen.findByRole('heading', { name: /Configure authentication/i });
    await user.type(screen.getByLabelText(/Secret value/i), 'super-secret');
    await user.click(screen.getByRole('button', { name: /Save & continue/i }));

    await waitFor(() =>
      expect(mockedCreateCredentials).toHaveBeenCalledWith(
        'mcp_petstore',
        expect.objectContaining({
          authType: 'apiKey',
          secret: 'super-secret',
        }),
      ),
    );
    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(await screen.findByText(/Secret configured/i)).toBeInTheDocument();
  });

  it('skips create when secret already exists and draft is empty', async () => {
    const user = userEvent.setup();
    mockedGetCredentials.mockResolvedValue({ binding: existingBinding });
    const { onNext } = renderAuthStep('mcp_petstore', { prefilledBinding: true });

    expect(screen.getByLabelText(/Replace secret/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save & continue/i }));

    await waitFor(() => expect(onNext).toHaveBeenCalled());
    expect(mockedCreateCredentials).not.toHaveBeenCalled();
  });

  it('shows API errors from credential save', async () => {
    const user = userEvent.setup();
    renderAuthStep();

    mockedCreateCredentials.mockRejectedValue(new ApiError('Invalid binding', 422));

    await screen.findByRole('heading', { name: /Configure authentication/i });
    await user.type(screen.getByLabelText(/Secret value/i), 'bad');
    await user.click(screen.getByRole('button', { name: /Save & continue/i }));

    expect(await screen.findByText(/Invalid binding/i)).toBeInTheDocument();
  });

  it('updates auth type config when switching to bearer', async () => {
    const user = userEvent.setup();
    renderAuthStep();

    await screen.findByLabelText(/Auth type/i);
    await user.selectOptions(screen.getByLabelText(/Auth type/i), 'bearer');
    expect(screen.queryByLabelText(/Parameter name/i)).not.toBeInTheDocument();
  });
});
