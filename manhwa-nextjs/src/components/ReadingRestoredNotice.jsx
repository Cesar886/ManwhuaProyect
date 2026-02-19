'use client';

import { useEffect, useState } from 'react';
import { IconBookmark } from '@tabler/icons-react';
import styles from './ReadingRestoredNotice.module.css';

/**
 * Notificación que aparece cuando se restaura la posición de lectura
 *
 * @param {boolean} show - Si debe mostrarse la notificación
 * @param {number} progress - Progreso restaurado en porcentaje
 */
export default function ReadingRestoredNotice({ show, progress }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show && progress > 5) {
      setVisible(true);
      // Auto-ocultar después de 4 segundos
      const timer = setTimeout(() => {
        setVisible(false);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [show, progress]);

  if (!visible) return null;

  return (
    <div className={styles.notice}>
      <div className={styles.content}>
        <IconBookmark size={20} className={styles.icon} />
        <div className={styles.text}>
          <strong>Continuando lectura</strong>
          <span>Progreso: {Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}
