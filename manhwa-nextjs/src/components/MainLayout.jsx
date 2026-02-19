"use client";

import { usePathname } from 'next/navigation';
import GlobalBreadcrumbs from '@/components/GlobalBreadcrumbs';

// Rutas donde NO queremos mostrar los breadcrumbs
const NO_BREADCRUMBS_PATHS = [
  '/login',
  '/register',
];

export default function MainLayout({ children }) {
  const pathname = usePathname();

  // Comprueba si la ruta actual debe ocultar los breadcrumbs
  const shouldHideBreadcrumbs = NO_BREADCRUMBS_PATHS.some(path => pathname.startsWith(path));

  return (
    <>
      {!shouldHideBreadcrumbs && <GlobalBreadcrumbs />}
      {children}
    </>
  );
}
