import React, { useState, useCallback } from 'react';
import { IconX, IconCircleCheck, IconAlertCircle, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import { ToastContext } from '../contexts/ToastContext';
import styles from './Toast.module.css';

/**
 * Sistema de Toast Notifications
 * Tipos: success, error, warning, info
 */

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    // Primero marcar como saliendo para animación
    setToasts(prev => prev.map(toast => 
      toast.id === id ? { ...toast, isExiting: true } : toast
    ));

    // Remover después de la animación
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = ++toastId;
    
    setToasts(prev => [...prev, {
      id,
      message,
      type,
      isExiting: false
    }]);

    // Auto-remove después del tiempo especificado
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [removeToast]);

  const toast = React.useMemo(() => ({
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration ?? 8000),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
    remove: removeToast,
    clear: () => setToasts([])
  }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map(toast => (
        <Toast 
          key={toast.id} 
          toast={toast} 
          onRemove={() => onRemove(toast.id)} 
        />
      ))}
    </div>
  );
}

function Toast({ toast, onRemove }) {
  const { message, type, isExiting } = toast;

  const icons = {
    success: <IconCircleCheck size={20} />,
    error: <IconAlertCircle size={20} />,
    warning: <IconAlertTriangle size={20} />,
    info: <IconInfoCircle size={20} />
  };

  return (
    <div 
      className={`${styles.toast} ${styles[type]} ${isExiting ? styles.exiting : ''}`}
      role="alert"
      aria-live="polite"
    >
      <span className={styles.icon}>{icons[type]}</span>
      <span className={styles.message}>{message}</span>
      <button 
        className={styles.closeButton}
        onClick={onRemove}
        aria-label="Cerrar notificación"
      >
        <IconX size={16} />
      </button>
    </div>
  );
}

export default ToastProvider;
