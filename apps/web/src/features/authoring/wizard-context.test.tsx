import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { WizardProvider, useWizard } from './WizardContext';

function PreviewProbe() {
  const { manifestPreview } = useWizard();
  return <span data-testid="preview">{manifestPreview ? 'yes' : 'no'}</span>;
}

function SeedWizard({
  ir,
}: {
  ir: import('@mcp-definer/schemas').IntermediateRepresentation;
}) {
  const { setIr, setMeta } = useWizard();
  useEffect(() => {
    setIr(ir);
    setMeta({ slug: 'pets', name: 'Pets', description: '', visibility: 'private' });
  }, [ir, setIr, setMeta]);
  return <PreviewProbe />;
}

describe('WizardProvider', () => {
  it('builds manifest preview when IR and slug are available', async () => {
    const ir = {
      irVersion: '1.0' as const,
      source: {
        type: 'swagger2' as const,
        hash: 'sha256:a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3',
      },
      servers: [{ url: 'https://example.com' }],
      operations: [
        {
          id: 'listPets',
          method: 'GET' as const,
          path: '/pets',
          parameters: [],
          responses: [{ status: '200' }],
        },
      ],
      securitySchemes: {},
    };

    render(
      <WizardProvider mode="create">
        <SeedWizard ir={ir} />
      </WizardProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('preview')).toHaveTextContent('yes');
    });
  });
});
