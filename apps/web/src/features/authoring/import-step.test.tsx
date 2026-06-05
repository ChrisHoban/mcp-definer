import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WizardProvider } from './WizardContext';
import { ImportStep } from './steps/ImportStep';

vi.mock('@/lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status = 400;
  },
  api: {
    parseSpec: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

const mockedParse = vi.mocked(api.parseSpec);

const mockIr = {
  irVersion: '1.0' as const,
  source: {
    type: 'swagger2' as const,
    hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
    title: 'Petstore API',
  },
  servers: [{ url: 'https://petstore.swagger.io/v2' }],
  operations: [],
  securitySchemes: {},
};

function renderStep(onNext = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider mode="create">
        <ImportStep onNext={onNext} />
      </WizardProvider>
    </QueryClientProvider>,
  );
}

describe('ImportStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedParse.mockResolvedValue({
      ir: mockIr,
      format: 'swagger2',
      warnings: [],
      operationCount: 0,
      specText: 'openapi: 2.0',
    });
  });

  it('parses pasted content and advances', async () => {
    const onNext = vi.fn();
    const user = userEvent.setup();
    renderStep(onNext);

    await user.type(screen.getByLabelText(/Slug/i), 'petstore');
    await user.type(
      screen.getByLabelText(/Or paste spec/i),
      'swagger: "2.0"\ninfo:\n  title: Petstore',
    );
    await user.click(screen.getByRole('button', { name: /Parse & continue/i }));

    await waitFor(() => expect(mockedParse).toHaveBeenCalled());
    await waitFor(() => expect(onNext).toHaveBeenCalled());
  });
});
