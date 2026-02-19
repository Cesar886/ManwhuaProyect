'use client';

import { createContext, useContext } from 'react';

/**
 * Context para configuración del layout desde páginas hijas
 */
export const LayoutContext = createContext({
  headerVariant: 'default', // 'default' | 'transparent' | 'hidden'
  showFooter: true,
  fullWidth: false,
});

/**
 * Hook para acceder al contexto del layout
 * 
 * @example
 * function MyPage() {
 *   const { headerVariant, showFooter } = useLayout();
 *   // ...
 * }
 */
export function useLayout() {
  return useContext(LayoutContext);
}
