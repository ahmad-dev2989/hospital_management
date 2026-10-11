import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Workstation Error Boundary caught an exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  handleClearAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Ignored
    }
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '720px',
            width: '100%',
            backgroundColor: '#1e293b',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                backgroundColor: '#fef2f2',
                padding: '0.5rem',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <AlertTriangle size={24} color="#dc2626" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  {this.props.fallbackTitle || 'Clinical Workstation Diagnostic Guard'}
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  An unexpected exception occurred during component render. Session state preserved.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div style={{
              backgroundColor: '#090d16',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.25rem',
              overflowX: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                <Terminal size={14} />
                <span>{this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error'}</span>
              </div>
              {this.state.error?.stack && (
                <pre style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  lineHeight: 1.4,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  maxHeight: '160px',
                  overflowY: 'auto'
                }}>
                  {this.state.error.stack}
                </pre>
              )}
            </div>

            {/* Component Stack */}
            {this.state.errorInfo?.componentStack && (
              <details style={{ marginBottom: '1.5rem', fontSize: '0.8rem', color: '#64748b' }}>
                <summary style={{ cursor: 'pointer', color: '#38bdf8', marginBottom: '0.5rem' }}>
                  Inspect Component Tree Stack
                </summary>
                <pre style={{
                  backgroundColor: '#090d16',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  fontSize: '0.725rem',
                  color: '#cbd5e1',
                  overflowX: 'auto',
                  maxHeight: '120px'
                }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#0d9488',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
                Reload Workstation
              </button>

              <button
                type="button"
                onClick={this.handleClearAndReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  border: 'none',
                  padding: '0.6rem 1.2rem',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={16} />
                Clear Local Cache & Restart
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
