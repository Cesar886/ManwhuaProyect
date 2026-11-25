'use client';

import React from 'react';

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

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
