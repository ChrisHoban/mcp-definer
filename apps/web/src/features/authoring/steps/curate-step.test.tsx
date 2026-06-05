import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { bulkSetExcluded, createEmptyCuration } from '@/lib/curation';
import { defaultWizardMeta, mockPetIr } from '@/test/wizard-fixtures';

import { WizardProvider, useWizard } from '../WizardContext';
import { CurateStep } from './CurateStep';

function SeedCurateWizard({ excludeAll = false }: { excludeAll?: boolean }) {
  const { setIr, setMeta, setCuration } = useWizard();
  useEffect(() => {
    setIr(mockPetIr);
    setMeta(defaultWizardMeta);
    if (excludeAll) {
      setCuration(bulkSetExcluded(createEmptyCuration(), ['listPets', 'getPet'], true));
    }
  }, [setIr, setMeta, setCuration, excludeAll]);
  return null;
}

function renderCurateStep(opts?: {
  onNext?: () => void;
  onSaveDraft?: () => Promise<void>;
  excludeAll?: boolean;
}) {
  const onNext = opts?.onNext ?? vi.fn();
  const onSaveDraft = opts?.onSaveDraft ?? vi.fn().mockResolvedValue(undefined);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });

  return {
    onNext,
    onSaveDraft,
    ...render(
      <QueryClientProvider client={queryClient}>
        <WizardProvider mode="create">
          <SeedCurateWizard excludeAll={opts?.excludeAll} />
          <CurateStep onNext={onNext} onBack={vi.fn()} onSaveDraft={onSaveDraft} saving={false} />
        </WizardProvider>
      </QueryClientProvider>,
    ),
  };
}

describe('CurateStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows message when no spec is loaded', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <WizardProvider mode="create">
          <CurateStep onNext={vi.fn()} onBack={vi.fn()} onSaveDraft={vi.fn()} saving={false} />
        </WizardProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/No spec loaded/i)).toBeInTheDocument();
  });

  it('lists included tools and edits metadata', async () => {
    const user = userEvent.setup();
    renderCurateStep();

    expect(await screen.findByRole('heading', { name: /Curate tools/i })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /Included tools/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Tool name/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'listAllPets');

    const descInput = screen.getByLabelText(/Description \(LLM-facing\)/i);
    await user.clear(descInput);
    await user.type(
      descInput,
      'Returns the full catalog of pets available in the store for agent browsing workflows.',
    );

    expect(screen.getByLabelText(/Group/i)).toBeInTheDocument();
  });

  it('saves draft and advances on continue', async () => {
    const user = userEvent.setup();
    const { onNext, onSaveDraft } = renderCurateStep();

    await screen.findByRole('heading', { name: /Curate tools/i });
    await user.click(screen.getByRole('button', { name: /Save draft & continue/i }));

    await waitFor(() => expect(onSaveDraft).toHaveBeenCalled());
    await waitFor(() => expect(onNext).toHaveBeenCalled());
  });

  it('shows error when save draft fails', async () => {
    const user = userEvent.setup();
    const onSaveDraft = vi.fn().mockRejectedValue(new Error('Network down'));
    renderCurateStep({ onSaveDraft });

    await screen.findByRole('heading', { name: /Curate tools/i });
    await user.click(screen.getByRole('button', { name: /Save draft & continue/i }));

    expect(await screen.findByText(/Network down/i)).toBeInTheDocument();
  });

  it('disables continue when no tools are included', async () => {
    renderCurateStep({ excludeAll: true });
    await screen.findByRole('heading', { name: /Curate tools/i });
    expect(screen.getByRole('button', { name: /Save draft & continue/i })).toBeDisabled();
  });
});
