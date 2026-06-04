import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { JsonSchemaForm } from './JsonSchemaForm';

describe('JsonSchemaForm', () => {
  it('renders object properties and calls onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <JsonSchemaForm
        schema={{
          type: 'object',
          properties: {
            petId: { type: 'integer', title: 'Pet ID' },
            status: { type: 'string', enum: ['available', 'pending', 'sold'] },
          },
          required: ['petId'],
        }}
        value={{ petId: 1, status: 'available' }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText(/Pet ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Pet ID/));
    await user.type(screen.getByLabelText(/Pet ID/), '42');

    expect(onChange).toHaveBeenCalled();
  });

  it('shows empty state for schema without properties', () => {
    render(
      <JsonSchemaForm
        schema={{ type: 'object', properties: {} }}
        value={{}}
        onChange={() => {}}
      />,
    );

    expect(screen.getByText(/No input parameters/)).toBeInTheDocument();
  });
});
