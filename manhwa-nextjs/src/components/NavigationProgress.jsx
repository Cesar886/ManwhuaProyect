'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import styles from './NavigationProgress.module.css';

/**
 * Barra de progreso optimizada que se muestra al navegar entre páginas
 * Se activa automáticamente al detectar cambios de ruta
 */
export default function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutsRef = useRef([]);
  const intervalsRef = useRef([]);
  const prevPathnameRef = useRef(pathname);

  useEffect(() => {
    // Solo activar si el pathname realmente cambió
    if (prevPathnameRef.current === pathname) {
      return;
    }

    prevPathnameRef.current = pathname;

    // Limpiar timers anteriores
    timeoutsRef.current.forEach(clearTimeout);
    intervalsRef.current.forEach(clearInterval);
    timeoutsRef.current = [];
    intervalsRef.current = [];

    setLoading(true);
    setProgress(0);

    // Progreso rápido inicial (0-70%)
    const fastInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 70) {
          clearInterval(fastInterval);

          // Progreso lento (70-90%)
          const slowInterval = setInterval(() => {
            setProgress((p) => {
              if (p >= 90) {
                clearInterval(slowInterval);
                return 90;
              }
              return p + 1;
            });
          }, 200);

          intervalsRef.current.push(slowInterval);
          return 70;
        }
        return prev + 10;
      });
    }, 100);

    intervalsRef.current.push(fastInterval);

    // Completar después de 500ms (asumiendo que la página cargó)
    const completeTimer = setTimeout(() => {
      setProgress(100);

      const hideTimer = setTimeout(() => {
        setLoading(false);
        setProgress(0);
      }, 300);

      timeoutsRef.current.push(hideTimer);
    }, 500);

    timeoutsRef.current.push(completeTimer);

    // Cleanup
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      intervalsRef.current.forEach(clearInterval);
      timeoutsRef.current = [];
      intervalsRef.current = [];
    };
  }, [pathname]);

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
