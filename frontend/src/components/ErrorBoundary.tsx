import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-acars-bg">
          <div className="max-w-md text-center space-y-4 p-8">
            <div className="text-4xl text-red-400/60">&#9888;</div>
            <h1 className="text-lg font-semibold text-acars-text">Something went wrong</h1>
            <p className="text-sm text-acars-muted">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.hash = '#/';
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-400/20 hover:bg-sky-500/20 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
