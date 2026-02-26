// Service Worker — Cache First para imágenes del CDN
const CACHE_NAME = 'manhwa-images-v1';
const MAX_ENTRIES = 500;
const CDN_ORIGIN = 'digitaloceanspaces.com';

// Solo interceptar requests de imágenes del CDN
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!request.url.includes(CDN_ORIGIN)) return;
  // Solo cachear imágenes (no JSON u otros recursos)
  const isImage = /\.(webp|avif|jpg|jpeg|png|gif)(\?.*)?$/i.test(request.url);
  if (!isImage) return;

  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Solo cachear respuestas exitosas y opacas (cross-origin)
    if (response.ok || response.type === 'opaque') {
      const clone = response.clone();
      // Cachear en background sin bloquear la respuesta
      enforceLRU(cache, clone, request);
    }
    return response;
  } catch (err) {
    // Si falla network y no hay cache, propagar el error
    throw err;
  }
}

async function enforceLRU(cache, response, request) {
  try {
    await cache.put(request, response);
    const keys = await cache.keys();
    if (keys.length > MAX_ENTRIES) {
      // Eliminar las entradas más antiguas (las primeras en la lista)
      const toDelete = keys.length - MAX_ENTRIES;
      for (let i = 0; i < toDelete; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch {
    // Silenciar errores de quota
  }
}

// Activar inmediatamente sin esperar a que se cierren pestañas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Tomar control inmediato en la primera instalación
self.addEventListener('install', () => {
  self.skipWaiting();
});
