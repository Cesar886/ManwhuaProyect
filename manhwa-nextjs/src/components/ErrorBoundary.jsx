'use client';

import React from 'react';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

/**
 * Error Boundary para capturar y manejar errores de React
 * Previene que la app completa se rompa por un error en un componente
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error para debugging
    console.error('🔴 Error Boundary caught:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Aquí podrías enviar el error a un servicio de logging (Sentry, LogRocket, etc.)
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false,
      });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: 'var(--page-bg)',
        }}>
          <div style={{
            maxWidth: '500px',
            textAlign: 'center',
            padding: '2rem',
            background: 'var(--card-bg)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
          }}>
            <IconAlertTriangle
              size={64}
              style={{ color: '#f59e0b', marginBottom: '1rem' }}
            />
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '0.5rem',
              color: 'var(--text-color)',
            }}>
              Algo salió mal
            </h2>
            <p style={{
              color: 'var(--dimmed-text)',
              marginBottom: '1.5rem',
              fontSize: '0.95rem',
            }}>
              Ocurrió un error inesperado. Por favor, recarga la página.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{
                textAlign: 'left',
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                fontSize: '0.85rem',
                color: '#ef4444',
              }}>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>
                  Ver detalles del error
                </summary>
                <pre style={{ overflow: 'auto', fontSize: '0.75rem' }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <button
              onClick={this.handleReset}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <IconRefresh size={18} />
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
