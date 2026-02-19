/**
 * Utilidad para registrar y gestionar el Service Worker
 */

/**
 * Registrar Service Worker
 */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker no soportado en este navegador');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/ssw.js', {
      scope: '/'
    });

    console.log('Service Worker registrado:', registration);

    // Manejar actualizaciones
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      console.log('Nueva versión del Service Worker disponible');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Nueva versión instalada, notificar al usuario
          console.log('Nueva versión lista. Recarga para actualizar.');
          // Aquí podrías mostrar un toast al usuario
        }
      });
    });

    return registration;
  } catch (error) {
    console.error('Error registrando Service Worker:', error);
    return null;
  }
}

/**
 * Desregistrar Service Worker (para debugging)
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    await registration.unregister();
  }
  console.log('Service Worker desregistrado');
}

/**
 * Limpiar toda la caché
 */
export async function clearAllCaches() {
  if (!('serviceWorker' in navigator)) return;

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('Todas las cachés eliminadas');

  // También notificar al SW
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'CLEAR_CACHE'
    });
  }
}

/**
 * Obtener tamaño de caché
 */
export async function getCacheSize() {
  if (!('serviceWorker' in navigator)) return 0;

  try {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          totalSize += blob.size;
        }
      }
    }

    return totalSize;
  } catch (error) {
    console.error('Error calculando tamaño de caché:', error);
    return 0;
  }
}

/**
 * Precachear capítulo (todas sus imágenes)
 */
export async function precacheChapter(imageUrls) {
  if (!navigator.serviceWorker.controller) {
    console.warn('Service Worker no activo');
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'PRECACHE_CHAPTER',
    urls: imageUrls
  });

  console.log(`Precacheando ${imageUrls.length} imágenes del capítulo`);
}

/**
 * Hook para usar Service Worker en React
 */
import { useState, useEffect } from 'react';

export function useServiceWorker() {
  const [isReady, setIsReady] = useState(false);
  const [isUpdateAvailable] = useState(false);
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    registerServiceWorker().then(registration => {
      if (registration) {
        setIsReady(true);

        // Verificar actualizaciones periódicamente
        setInterval(() => {
          registration.update();
        }, 60000); // cada minuto
      }
    });

    // Actualizar tamaño de caché
    const updateCacheSize = async () => {
      const size = await getCacheSize();
      setCacheSize(size);
    };

    updateCacheSize();
    const interval = setInterval(updateCacheSize, 30000); // cada 30s

    return () => clearInterval(interval);
  }, []);

  return {
    isReady,
    isUpdateAvailable,
    cacheSize,
    cacheSizeMB: (cacheSize / 1024 / 1024).toFixed(2),
    clearCache: clearAllCaches,
    precacheChapter
  };
}