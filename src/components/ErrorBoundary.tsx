import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('[UserFlowAnalytics] Caught UI error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto my-8 max-w-lg rounded-xl border border-[#FECDD3] bg-[#FFF1F2] p-6 text-center"
        >
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFE4E6] text-[#BE123C]">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-bold text-[#881337]">Something went wrong rendering this view</h2>
          <p className="mt-1 font-mono text-xs text-[#9F1239]">{this.state.errorMessage}</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, errorMessage: '' });
              window.location.reload();
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0F294D] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1E3A63]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload View
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
