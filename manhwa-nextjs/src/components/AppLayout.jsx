'use client';

import React, { useMemo } from 'react';
import Header from './Header';
import Footer from './Footer';
import { LayoutContext } from '../hooks/useLayout.jsx';
import styles from './AppLayout.module.css';

/**
 * AppLayout - Layout principal de la aplicación
 * 
 * Maneja automáticamente:
 * - Spacing correcto para el header fixed
 * - Estructura semántica HTML (header, main, footer)
 * - Variantes para páginas especiales (landing, fullscreen, etc.)
 * - Responsive design con variables CSS
 * 
 * Props:
 * - children: Contenido de la página (rutas)
 * - colorScheme: 'dark' | 'light'
 * - toggleColorScheme: Función para cambiar el tema
 * - headerVariant: 'default' | 'transparent' | 'hidden'
 * - showFooter: boolean (default: true)
 * - fullWidth: boolean - Si true, el main no tiene max-width
 * - className: Clase adicional para el wrapper
 * 
 * @example
 * // Uso básico en App.jsx
 * <AppLayout colorScheme={colorScheme} toggleColorScheme={toggleColorScheme}>
 *   <Routes>
 *     <Route path="/" element={<Home />} />
 *   </Routes>
 * </AppLayout>
 * 
 * @example
 * // Página con header transparente (landing page)
 * <AppLayout headerVariant="transparent" showFooter={false}>
 *   <LandingPage />
 * </AppLayout>
 */
export default function AppLayout({
  children,
  colorScheme,
  toggleColorScheme,
  headerVariant = 'default',
  showFooter = true,
  fullWidth = false,
  className = '',
}) {
  // Memoizar el valor del contexto para evitar re-renders innecesarios
  const layoutContextValue = useMemo(() => ({
    headerVariant,
    showFooter,
    fullWidth,
  }), [headerVariant, showFooter, fullWidth]);

  // Determinar clases del layout según variante
  const layoutClasses = [
    styles.appLayout,
    headerVariant === 'transparent' && styles.transparentHeader,
    headerVariant === 'hidden' && styles.hiddenHeader,
    fullWidth && styles.fullWidth,
    className,
  ].filter(Boolean).join(' ');

  // Determinar clases del main
  const mainClasses = [
    styles.mainContent,
    headerVariant === 'transparent' && styles.mainNoOffset,
    headerVariant === 'hidden' && styles.mainNoOffset,
  ].filter(Boolean).join(' ');

  return (
    <LayoutContext.Provider value={layoutContextValue}>
      <div className={layoutClasses}>
        {/* Fondo con gradiente sutil - Capa decorativa */}
        <div className={styles.backgroundGradient} aria-hidden="true" />

        {/* Header - Solo renderizar si no está oculto */}
        {headerVariant !== 'hidden' && (
          <Header 
            colorScheme={colorScheme} 
            toggleColorScheme={toggleColorScheme}
            transparent={headerVariant === 'transparent'}
          />
        )}

        {/* Contenido Principal */}
        <main
          className={mainClasses}
          id="main-content"
          role="main"
        >
          {children}
        </main>

        {/* Footer - Solo renderizar si showFooter es true */}
        {showFooter && <Footer />}
      </div>
    </LayoutContext.Provider>
  );
}

/**
 * Componente wrapper para páginas que necesitan configuración especial de layout
 * 
 * Útil para cuando no puedes pasar props directamente al AppLayout
 * pero quieres que una página específica tenga comportamiento diferente
 * 
 * @example
 * // Dentro de una página que quiere header transparente
 * function LandingPage() {
 *   return (
 *     <PageWrapper headerVariant="transparent" showFooter={false}>
 *       <HeroSection />
 *     </PageWrapper>
 *   );
 * }
 */
export function PageWrapper({ 
  children, 
  className = '',
  noPadding = false,
  maxWidth = true,
}) {
  const wrapperClasses = [
    styles.pageWrapper,
    noPadding && styles.noPadding,
    !maxWidth && styles.noMaxWidth,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {children}
    </div>
  );
}

/**
 * Componente para páginas de pantalla completa (fullscreen)
 * Útil para lectores de capítulos, galerías, etc.
 */
export function FullscreenPage({ children, className = '' }) {
  return (
    <div className={`${styles.fullscreenPage} ${className}`}>
      {children}
    </div>
  );
}
