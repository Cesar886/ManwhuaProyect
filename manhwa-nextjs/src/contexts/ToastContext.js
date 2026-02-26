'use client'

import React, { createContext } from 'react';
import { Notifications, notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.layer.css';

/**
 * Contexto para el sistema de Toast Notifications
 */
export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  return (
    <ToastContext.Provider value={{}}>
      {children}
    </ToastContext.Provider>
  );
}

export default ToastContext;
