import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { WizardProvider, useWizard } from '../WizardContext';
import { TestStep } from './TestStep';

function SeedMcpId({ mcpId }: { mcpId?: string }) {
  const { setMcpId } = useWizard();
  useEffect(() => {
    if (mcpId) {
      setMcpId(mcpId);
    }
  }, [mcpId, setMcpId]);
  return null;
}

function renderTestStep(mcpId?: string) {
  const onNext = vi.fn();
  const onBack = vi.fn();

  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <WizardProvider mode="create" initialMcpId={mcpId}>
          <SeedMcpId mcpId={mcpId} />
          <TestStep onNext={onNext} onBack={onBack} />
        </WizardProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { onNext, onBack };
}

describe('TestStep', () => {
  it('shows optional test guidance without a saved MCP', () => {
    renderTestStep();
    expect(screen.getByRole('heading', { name: /Test tools \(optional\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Test console coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open test console/i })).not.toBeInTheDocument();
  });

  it('links to the test console when an MCP exists', () => {
    renderTestStep('mcp_42');
    const link = screen.getByRole('link', { name: /Open test console/i });
    expect(link).toHaveAttribute('href', '/mcps/mcp_42/test');
  });

  it('skips to publish or goes back', async () => {
    const user = userEvent.setup();
    const { onNext, onBack } = renderTestStep('mcp_42');

    await user.click(screen.getByRole('button', { name: /Skip to publish/i }));
    await user.click(screen.getByRole('button', { name: /Back/i }));

    expect(onNext).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
