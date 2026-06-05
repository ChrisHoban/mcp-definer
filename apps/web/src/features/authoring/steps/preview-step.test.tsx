import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        start: index * 52,
        size: 52,
        key: index,
      })),
    getTotalSize: () => count * 52,
  }),
}));

import type { IntermediateRepresentation } from '@mcp-definer/schemas';

import { bulkSetExcluded, createEmptyCuration } from '@/lib/curation';
import { defaultWizardMeta } from '@/test/wizard-fixtures';

import { OperationsTable } from '../components/OperationsTable';
import { WizardProvider, useWizard } from '../WizardContext';
import { PreviewStep } from './PreviewStep';

const taggedIr: IntermediateRepresentation = {
  irVersion: '1.0',
  source: { type: 'swagger2', hash: 'sha256:abc', title: 'Tagged API' },
  servers: [{ url: 'https://api.example.com' }],
  operations: [
    {
      id: 'listPets',
      method: 'GET',
      path: '/pets',
      summary: 'List pets',
      tags: ['pets'],
      parameters: [],
      responses: [{ status: '200' }],
    },
    {
      id: 'createPet',
      method: 'POST',
      path: '/pets',
      summary: 'Create pet',
      tags: ['pets', 'write'],
      parameters: [],
      responses: [{ status: '201' }],
    },
    {
      id: 'getStore',
      method: 'GET',
      path: '/store',
      summary: 'Store inventory',
      tags: ['store'],
      parameters: [],
      responses: [{ status: '200' }],
    },
  ],
  securitySchemes: {},
};

function SeedPreviewWizard() {
  const { setIr, setMeta } = useWizard();
  useEffect(() => {
    setIr(taggedIr);
    setMeta(defaultWizardMeta);
  }, [setIr, setMeta]);
  return null;
}

function renderPreviewStep() {
  const onNext = vi.fn();
  const onBack = vi.fn();
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <WizardProvider mode="create">
        <SeedPreviewWizard />
        <PreviewStep onNext={onNext} onBack={onBack} />
      </WizardProvider>
    </QueryClientProvider>,
  );

  return { onNext, onBack };
}

describe('PreviewStep', () => {
  it('shows message when no spec is loaded', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WizardProvider mode="create">
          <PreviewStep onNext={vi.fn()} onBack={vi.fn()} />
        </WizardProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/No spec loaded/i)).toBeInTheDocument();
  });

  it('renders operations table and manifest preview', async () => {
    renderPreviewStep();

    expect(await screen.findByRole('heading', { name: /Preview operations/i })).toBeInTheDocument();
    expect(screen.getByText(/3 operations discovered/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Search operations/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /How the agent sees this/i })).toBeInTheDocument();
  });

  it('advances and goes back via actions', async () => {
    const user = userEvent.setup();
    const { onNext, onBack } = renderPreviewStep();

    await screen.findByRole('heading', { name: /Preview operations/i });
    await user.click(screen.getByRole('button', { name: /Continue to curation/i }));
    await user.click(screen.getByRole('button', { name: /Back/i }));

    expect(onNext).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});

describe('OperationsTable', () => {
  function renderTable(
    curation = createEmptyCuration(),
    onCurationChange = vi.fn(),
  ) {
    return render(
      <OperationsTable
        operations={taggedIr.operations}
        curation={curation}
        onCurationChange={onCurationChange}
      />,
    );
  }

  it('filters operations and toggles inclusion', async () => {
    const user = userEvent.setup();
    const onCurationChange = vi.fn();
    const { rerender } = renderTable(createEmptyCuration(), onCurationChange);

    expect(screen.getByText('3 included')).toBeInTheDocument();
    expect(screen.getByLabelText(/Include listPets/i)).toBeChecked();

    await user.type(screen.getByRole('textbox', { name: /Search operations/i }), 'store');
    expect(screen.getByText('1 shown')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Include listPets/i)).not.toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: /Search operations/i }));
    await user.selectOptions(screen.getByLabelText(/Filter by method/i), 'POST');
    expect(screen.getByText('1 shown')).toBeInTheDocument();
    expect(screen.getByLabelText(/Include createPet/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Filter by method/i), '');
    await user.selectOptions(screen.getByLabelText(/Filter by tag/i), 'store');
    expect(screen.getByLabelText(/Include getStore/i)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Filter by tag/i), '');
    expect(screen.getByText('3 shown')).toBeInTheDocument();
    await user.click(screen.getByLabelText(/Include listPets/i));
    expect(onCurationChange).toHaveBeenCalledWith(
      expect.objectContaining({
        excludedOperationIds: ['listPets'],
      }),
    );

    onCurationChange.mockClear();
    rerender(
      <OperationsTable
        operations={taggedIr.operations}
        curation={bulkSetExcluded(createEmptyCuration(), taggedIr.operations.map((op) => op.id), true)}
        onCurationChange={onCurationChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Include visible/i }));
    expect(onCurationChange).toHaveBeenCalled();

    onCurationChange.mockClear();
    rerender(
      <OperationsTable
        operations={taggedIr.operations}
        curation={createEmptyCuration()}
        onCurationChange={onCurationChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Exclude visible/i }));
    expect(onCurationChange).toHaveBeenCalled();
  });

  it('shows empty state when filters match nothing', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.type(screen.getByRole('textbox', { name: /Search operations/i }), 'zzznomatch');
    expect(screen.getByText(/No operations match the current filters/i)).toBeInTheDocument();
  });
});
