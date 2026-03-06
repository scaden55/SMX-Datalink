import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-acars-bg">
          <div className="max-w-lg text-center space-y-4 p-8">
            <div className="text-4xl text-red-400/60">&#9888;</div>
            <h1 className="text-lg font-semibold text-acars-text">Something went wrong</h1>
            <p className="text-sm text-acars-muted">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            {this.state.componentStack && (
              <pre className="text-left text-[10px] text-acars-muted/70 bg-acars-input border border-acars-border rounded p-3 max-h-48 overflow-auto whitespace-pre-wrap tabular-nums">
                {this.state.componentStack}
              </pre>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, componentStack: null });
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
