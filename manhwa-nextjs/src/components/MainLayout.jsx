"use client";

import { usePathname } from 'next/navigation';
import GlobalBreadcrumbs from '@/components/GlobalBreadcrumbs';
import Footer from '@/components/Footer';
import ErrorBoundary from '@/components/ErrorBoundary';
import LangBanner from '@/components/LangBanner';

// Rutas donde NO queremos mostrar los breadcrumbs ni el footer
const NO_BREADCRUMBS_PATHS = [
  '/login',
  '/register',
];

export default function MainLayout({ children, lang }) {
  const pathname = usePathname() || '';
  const activeLang = lang || (pathname.startsWith('/en') ? 'en' : 'es');

  // Comprueba si la ruta actual debe ocultar los breadcrumbs y el footer
  const shouldHideBreadcrumbs = NO_BREADCRUMBS_PATHS.some(path => pathname.startsWith(path));

  return (
    <>
      <LangBanner />
      {!shouldHideBreadcrumbs && <GlobalBreadcrumbs lang={activeLang} />}
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
      {!shouldHideBreadcrumbs && <Footer lang={activeLang} />}
    </>
  );
}
