import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AuthProvider, useAuth } from './AuthContext';

function Probe() {
  const { role, can, canView, setRole } = useAuth();
  return (
    <div>
      <span data-testid="role">{role}</span>
      <span data-testid="publish">{String(can('mcp:publish'))}</span>
      <span data-testid="view-public">
        {String(canView({ visibility: 'public' }))}
      </span>
      <button type="button" onClick={() => setRole('admin')}>
        Promote
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  it('exposes role permissions and updates role', async () => {
    localStorage.setItem('mcp-definer-role', 'viewer');
    const user = userEvent.setup();

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('role')).toHaveTextContent('viewer');
    expect(screen.getByTestId('publish')).toHaveTextContent('false');
    expect(screen.getByTestId('view-public')).toHaveTextContent('true');

    await user.click(screen.getByRole('button', { name: 'Promote' }));
    expect(screen.getByTestId('role')).toHaveTextContent('admin');
    expect(localStorage.getItem('mcp-definer-role')).toBe('admin');
  });

});
