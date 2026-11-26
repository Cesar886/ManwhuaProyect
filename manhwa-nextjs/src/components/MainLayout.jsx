"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import GlobalBreadcrumbs from '@/components/GlobalBreadcrumbs';
import Footer from '@/components/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';
// Rutas donde NO queremos mostrar los breadcrumbs ni el footer
const NO_BREADCRUMBS_PATHS = [
  '/login',
  '/register',
];
const NO_FOOTER_PATHS = [
  '/muro',
  '/en/wall',
];

export default function MainLayout({ children, lang }) {
  const pathname = usePathname() || '';
  const activeLang = lang || (pathname.startsWith('/en') ? 'en' : 'es');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !('serviceWorker' in navigator)) return;

    // A worker installed by a previous local production run remains active
    // after switching to `next dev` and can serve obsolete JS chunks.
    let active = true;
    (async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const ours = registrations.filter(registration =>
        registration.active?.scriptURL === `${window.location.origin}/sw.js`
      );
      if (!ours.length || !active) return;
      await Promise.all(ours.map(registration => registration.unregister()));
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.startsWith('mi-static-')).map(name => caches.delete(name)));
      if (active && navigator.serviceWorker.controller) window.location.reload();
    })().catch(error => console.warn('No se pudo limpiar el service worker de desarrollo.', error));
    return () => { active = false; };
  }, []);

  // Comprueba si la ruta actual debe ocultar los breadcrumbs y el footer
  const shouldHideBreadcrumbs = NO_BREADCRUMBS_PATHS.some(path => pathname.startsWith(path));
  const shouldHideFooter = NO_FOOTER_PATHS.some(path => pathname.startsWith(path));

  return (
    <>
      {!shouldHideBreadcrumbs && <GlobalBreadcrumbs lang={activeLang} />}
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      {!shouldHideFooter && <Footer lang={activeLang} />}
    </>
  );
}
