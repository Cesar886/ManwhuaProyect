'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import styles from './NavigationProgress.module.css';

/**
 * Barra de progreso que se muestra al navegar entre páginas.
 * Se activa inmediatamente al hacer click en un link interno (intercepta clicks)
 * y se completa cuando el pathname cambia.
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef(null);
  const prevPathnameRef = useRef(pathname);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    cleanup();
    setLoading(true);
    setProgress(0);

    // Progreso incremental que se desacelera al acercarse a 90%
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          return 90;
        }
        // Avanza rápido al inicio, lento después
        const increment = prev < 30 ? 8 : prev < 60 ? 4 : prev < 80 ? 2 : 0.5;
        return Math.min(prev + increment, 90);
      });
    }, 150);
  }, [cleanup]);

  const completeProgress = useCallback(() => {
    cleanup();
    setProgress(100);
    setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 300);
  }, [cleanup]);

  // Interceptar clicks en links internos para activar la barra inmediatamente
  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a[href]');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      // Solo links internos que no sean el mismo pathname
      if (href && href.startsWith('/') && href !== pathname) {
        startProgress();
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [pathname, startProgress]);

  // Completar cuando el pathname cambia
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      if (loading) {
        completeProgress();
      }
    }
  }, [pathname, loading, completeProgress]);

  // Cleanup al desmontar
  useEffect(() => cleanup, [cleanup]);

  if (!loading) return null;

  return (
    <div className={styles.progressContainer}>
      <div
        className={styles.progressBar}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
