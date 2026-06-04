import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { AuthProvider } from '@/context/AuthContext';

import { CreateWizardPage } from './CreateWizardPage';

function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter>
          <CreateWizardPage />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('CreateWizardPage', () => {
  it('renders import step with stepper', () => {
    renderWizard();

    expect(screen.getByRole('heading', { name: /Create MCP/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Import OpenAPI spec/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /Wizard progress/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Parse & continue/i })).toBeDisabled();
  });
});
