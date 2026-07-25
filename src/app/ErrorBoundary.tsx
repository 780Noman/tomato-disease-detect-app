import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState, Screen } from '@/components';

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/**
 * Root render-crash catcher (CLAUDE.md §9). Dev builds show the real
 * message; production shows recovery copy. Reset re-renders the tree.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the dev console; production crash reporting can hook here.
    console.error('Render crash caught by ErrorBoundary', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    return (
      <Screen scroll={false} testID="error-boundary">
        <ErrorState
          title="The app hit a problem"
          message={
            __DEV__
              ? error.message
              : 'The screen crashed while rendering. Your saved scans are safe. Tap below to recover.'
          }
          onRetry={this.reset}
          retryLabel="Recover"
        />
      </Screen>
    );
  }
}
