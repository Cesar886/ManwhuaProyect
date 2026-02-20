'use client'

import React, { createContext } from 'react';
import { Notifications } from '@mantine/notifications';
import '@mantine/notifications/styles.layer.css';

/**
 * Contexto para el sistema de Toast Notifications
 */
export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  return (
    <>
      <Notifications position="top-right" zIndex={1000} />
      <ToastContext.Provider value={{}}>
        {children}
      </ToastContext.Provider>
    </>
  );
}

export default ToastContext;
