import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentPreviewPanel } from './AgentPreviewPanel';

describe('AgentPreviewPanel', () => {
  it('lists enabled tools with descriptions', () => {
    render(
      <AgentPreviewPanel
        tools={[
          {
            name: 'getPetById',
            description: 'Fetch a pet',
            enabled: true,
            group: 'pets',
            inputSchema: { type: 'object', properties: { petId: { type: 'integer' } } },
            request: {
              method: 'GET',
              pathTemplate: '/pet/{petId}',
              paramMap: { petId: { in: 'path' } },
              bodyParam: null,
            },
            response: {
              successStatus: ['200'],
              shape: 'passthrough',
              errorMap: { default: 'raise' },
            },
          },
          {
            name: 'disabledTool',
            description: 'Hidden',
            enabled: false,
            inputSchema: { type: 'object' },
            request: {
              method: 'GET',
              pathTemplate: '/x',
              paramMap: {},
              bodyParam: null,
            },
            response: {
              successStatus: ['200'],
              shape: 'passthrough',
              errorMap: { default: 'raise' },
            },
          },
        ]}
      />,
    );

    expect(screen.getByText('getPetById')).toBeInTheDocument();
    expect(screen.getByText('Fetch a pet')).toBeInTheDocument();
    expect(screen.getByText('1 tools')).toBeInTheDocument();
    expect(screen.queryByText('disabledTool')).not.toBeInTheDocument();
  });
});
