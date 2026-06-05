import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardProvider } from '../WizardContext';
import { ValidateStep } from './ValidateStep';

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {},
  api: { validateVersion: vi.fn() },
}));

import { api } from '@/lib/api-client';

const mockedValidate = vi.mocked(api.validateVersion);

function renderStep(mcpId: string | null = 'mcp_1') {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider mode="create" initialMcpId={mcpId ?? undefined}>
        <ValidateStep onNext={vi.fn()} onBack={vi.fn()} />
      </WizardProvider>
    </QueryClientProvider>,
  );
}

describe('ValidateStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedValidate.mockResolvedValue({
      valid: true,
      errors: [],
      warnings: [{ message: 'Minor', code: 'WARN' }],
    });
  });

  it('warns when MCP id is missing', () => {
    renderStep(null);
    expect(screen.getByText(/Complete previous steps/i)).toBeInTheDocument();
  });

  it('runs validation and shows success state', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: /Run validation/i }));
    expect(await screen.findByText(/Manifest is valid/i)).toBeInTheDocument();
    expect(mockedValidate).toHaveBeenCalledWith('mcp_1', '0.1.0');
  });
});
