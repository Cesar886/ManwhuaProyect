import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

/**
 * Hook para usar el sistema de Toast notifications
 * Debe usarse dentro de un ToastProvider
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Retornar un fallback en lugar de lanzar error
    // para permitir uso fuera del provider con funcionalidad limitada
    return {
      success: (msg) => console.log('✅', msg),
      error: (msg) => console.error('❌', msg),
      warning: (msg) => console.warn('⚠️', msg),
      info: (msg) => console.info('ℹ️', msg),
      remove: () => {},
      clear: () => {}
    };
  }
  return context;
}

export default useToast;
