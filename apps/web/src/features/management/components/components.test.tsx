import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncState } from './AsyncState';
import { ConfirmDialog } from './ConfirmDialog';
import { InstallPanel } from './InstallPanel';

vi.mock('@/lib/api-client', () => ({
  discoveryApi: {
    getInstallSnippet: vi.fn(),
  },
}));

import { discoveryApi } from '@/lib/api-client';

const mockedInstall = vi.mocked(discoveryApi.getInstallSnippet);

describe('AsyncState', () => {
  it('shows loading spinner', () => {
    render(
      <AsyncState isLoading error={null}>
        <div>Content</div>
      </AsyncState>,
    );
    expect(screen.getByText(/Loading/)).toBeInTheDocument();
  });

  it('shows error alert', () => {
    render(
      <AsyncState isLoading={false} error={new Error('boom')}>
        <div>Content</div>
      </AsyncState>,
    );
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });

  it('shows empty message', () => {
    render(
      <AsyncState isLoading={false} error={null} isEmpty emptyMessage="No items">
        <div>Content</div>
      </AsyncState>,
    );
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders children when ready', () => {
    render(
      <AsyncState isLoading={false} error={null}>
        <div>Ready content</div>
      </AsyncState>,
    );
    expect(screen.getByText('Ready content')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('calls confirm handler and closes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Delete MCP"
        message="Are you sure?"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('InstallPanel', () => {
  beforeEach(() => {
    mockedInstall.mockResolvedValue({
      harness: 'cursor',
      snippet: {
        command: 'npx',
        args: ['-y', '@mcp-definer/runtime', '--manifest', 'http://example/manifest'],
        env: { KEY: 'value' },
      },
    });
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads and displays install snippet', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <InstallPanel org="acme" slug="petstore" version="1.0.0" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('heading', { name: 'Install' })).toBeInTheDocument();
    expect(screen.getByText(/CLI command/)).toBeInTheDocument();
    expect(mockedInstall).toHaveBeenCalledWith('acme', 'petstore', 'cursor', '1.0.0');
  });
});
