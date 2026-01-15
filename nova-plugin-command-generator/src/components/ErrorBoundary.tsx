import React from 'react';
import { logError } from '../utils/telemetry';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logError(error, { source: 'ErrorBoundary', componentStack: info.componentStack });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error } = this.state;
    if (!hasError) return this.props.children;

    return (
      <div className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <h1>页面出现异常</h1>
          <p>我们已记录错误日志，你可以尝试刷新或重置页面状态。</p>
          {error?.message && <code className="error-boundary-detail">{error.message}</code>}
          <div className="error-boundary-actions">
            <button className="btn" onClick={this.handleReload}>
              刷新页面
            </button>
            <button className="btn ghost" onClick={this.handleReset}>
              继续使用
            </button>
          </div>
        </div>
      </div>
    );
  }
}
