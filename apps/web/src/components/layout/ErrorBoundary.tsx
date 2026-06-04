import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Alert, Button } from '@/components/ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '2rem', maxWidth: 640 }}>
          <Alert variant="danger">
            <strong>Something went wrong</strong>
            <p>{this.state.error.message}</p>
          </Alert>
          <Button variant="secondary" onClick={() => this.setState({ error: null })} style={{ marginTop: '1rem' }}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
