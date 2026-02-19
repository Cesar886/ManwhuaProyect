'use client';

import { useEffect, useState } from 'react';
import styles from './ReadingProgressBar.module.css';

/**
 * Barra de progreso de lectura que muestra el avance en el capítulo
 * Se muestra fija en la parte superior o inferior de la pantalla
 *
 * @param {number} progress - Progreso en porcentaje (0-100)
 * @param {string} position - Posición de la barra ('top' | 'bottom')
 */
export default function ReadingProgressBar({ progress = 0, position = 'top' }) {
  const [visible, setVisible] = useState(false);

  // Mostrar la barra solo cuando el usuario empiece a hacer scroll
  useEffect(() => {
    if (progress > 1) {
      setVisible(true);
    }
  }, [progress]);

  if (!visible) return null;

  return (
    <div
      className={`${styles.progressContainer} ${styles[position]}`}
      role="progressbar"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Progreso de lectura: ${Math.round(progress)}%`}
    >
      <div
        className={styles.progressBar}
        style={{ width: `${progress}%` }}
      >
        <div className={styles.progressGlow} />
      </div>
      {progress >= 95 && (
        <div className={styles.completionIndicator}>
          ✓ Capítulo completado
        </div>
      )}
    </div>
  );
}
