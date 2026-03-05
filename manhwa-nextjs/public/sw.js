// Service Worker — Cache First para imágenes de capítulos (cualquier host)
const CACHE_NAME = 'manhwa-images-v4';
const MAX_ENTRIES = 500;
const IA_API_ORIGIN = 'ai.manhwaimperial.site';
// Orígenes propios que NO deben cachearse aquí (Next.js ya los maneja)
const SELF_ORIGIN = self.location.origin;

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // IA API — dejar que el navegador maneje CORS directamente (no interceptar)
  if (request.url.includes(IA_API_ORIGIN)) return;

  // Solo imágenes externas (no las del propio sitio, Next.js las maneja)
  if (request.url.startsWith(SELF_ORIGIN)) return;

  // Cache First para cualquier imagen externa (capítulos vienen de múltiples hosts)
  const isImage = /\.(webp|avif|jpg|jpeg|png|gif)(\?.*)?$/i.test(request.url);
  if (!isImage) return;

  event.respondWith(cacheFirst(request));
});

// --- CDN Images: Cache First ---
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    // Para imágenes cross-origin, necesitamos usar 'no-cors' mode.
    // Sin esto, el fetch falla con NetworkError cuando el servidor externo
    // (ej. ImageShack) no envía headers CORS.
    // Las etiquetas <img> normalmente hacen esto automáticamente,
    // pero el ServiceWorker necesita hacerlo explícitamente.
    const fetchRequest = new Request(request.url, {
      mode: 'no-cors',
      credentials: 'omit',
      redirect: 'follow',
    });

    const response = await fetch(fetchRequest);
    // Las respuestas no-cors son "opaque" (status 0), pero son válidas para imágenes
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
