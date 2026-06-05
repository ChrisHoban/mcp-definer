import type { ReactNode } from 'react';

import { Alert, Spinner } from '@/components/ui';

export function AsyncState({
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'Nothing to show yet.',
  children,
}: {
  isLoading: boolean;
  error: Error | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '2rem 0' }}>
        <Spinner />
        <span style={{ color: 'var(--text-muted)' }}>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <strong>Error:</strong> {error.message}
      </Alert>
    );
  }

  if (isEmpty) {
    return <Alert variant="info">{emptyMessage}</Alert>;
  }

  return children;
}
