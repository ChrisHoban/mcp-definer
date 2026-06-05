import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './ErrorBoundary';

function Boom(): never {
  throw new Error('render failed');
}

describe('ErrorBoundary', () => {
  it('renders fallback UI when child throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
    expect(screen.getByText('render failed')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('recovers when Try again is clicked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function MaybeBoom() {
      if (shouldThrow) throw new Error('once');
      return <p>Recovered</p>;
    }

    const user = userEvent.setup();
    render(
      <ErrorBoundary>
        <MaybeBoom />
      </ErrorBoundary>,
    );

    expect(screen.getByText('once')).toBeInTheDocument();
    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /Try again/i }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
