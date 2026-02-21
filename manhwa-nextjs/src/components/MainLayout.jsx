"use client";

import { usePathname } from 'next/navigation';
import GlobalBreadcrumbs from '@/components/GlobalBreadcrumbs';
import Footer from '@/components/Footer';

// Rutas donde NO queremos mostrar los breadcrumbs ni el footer
const NO_BREADCRUMBS_PATHS = [
  '/login',
  '/register',
];

export default function MainLayout({ children }) {
  const pathname = usePathname();

  // Comprueba si la ruta actual debe ocultar los breadcrumbs y el footer
  const shouldHideBreadcrumbs = NO_BREADCRUMBS_PATHS.some(path => pathname.startsWith(path));

  return (
    <>
      {!shouldHideBreadcrumbs && <GlobalBreadcrumbs />}
      {children}
      {!shouldHideBreadcrumbs && <Footer />}
    </>
  );
}
