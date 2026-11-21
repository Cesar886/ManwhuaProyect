'use client';

import { useEffect, useState } from 'react';
import styles from './PwaRuntime.module.css';

export default function PwaRuntime() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return undefined;

    let active = true;
    let reloadOnControllerChange = false;
    let registration;

    const onControllerChange = () => {
      if (reloadOnControllerChange) window.location.reload();
    };

    const checkForWaitingWorker = (currentRegistration) => {
      if (currentRegistration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(currentRegistration.waiting);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((currentRegistration) => {
        if (!active) return;
        registration = currentRegistration;
        checkForWaitingWorker(registration);
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(registration.waiting || installingWorker);
            }
          });
        });
      })
      .catch((error) => console.error('No se pudo registrar el service worker de Manhwa Imperial.', error));

    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  if (!waitingWorker) return null;

  const updateApp = () => {
    setIsUpdating(true);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <span>Nueva versión disponible</span>
      <button type="button" onClick={updateApp} disabled={isUpdating}>
        {isUpdating ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  );
}
