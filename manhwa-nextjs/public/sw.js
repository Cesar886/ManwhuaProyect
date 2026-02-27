// Service Worker — Cache First para imágenes del CDN + Network First para IA API
const CACHE_NAME = 'manhwa-images-v1';
const IA_CACHE_NAME = 'manhwa-ia-v1';
const MAX_ENTRIES = 500;
const IA_MAX_ENTRIES = 50;
const IA_TTL = 30 * 60 * 1000; // 30 minutos
const CDN_ORIGIN = 'digitaloceanspaces.com';
const IA_API_ORIGIN = 'ai.manhwaimperial.site/api/read';

// Hash simple para crear claves de caché compactas a partir del body del POST
async function hashBody(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // IA API — Network First (solo POST)
  if (request.url.includes(IA_API_ORIGIN) && request.method === 'POST') {
    event.respondWith(networkFirstIA(request));
    return;
  }

  // CDN Images — Cache First
  if (!request.url.includes(CDN_ORIGIN)) return;
  const isImage = /\.(webp|avif|jpg|jpeg|png|gif)(\?.*)?$/i.test(request.url);
  if (!isImage) return;

  event.respondWith(cacheFirst(request));
});

// --- IA API: Network First con fallback a cache ---
async function networkFirstIA(request) {
  const cache = await caches.open(IA_CACHE_NAME);

  // Crear clave de cache compacta a partir del hash del body
  const body = await request.clone().text();
  const bodyHash = await hashBody(body);
  const cacheKey = new Request(request.url + '?_h=' + bodyHash, { method: 'GET' });

  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      // Almacenar con timestamp para TTL
      const responseBody = await clone.text();
      const wrappedResponse = new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          'x-sw-cached-at': Date.now().toString(),
        },
      });
      enforceIALRU(cache, wrappedResponse, cacheKey);
    }
    return response;
  } catch (err) {
    // Network falló — intentar cache
    const cached = await cache.match(cacheKey);
    if (cached) {
      const cachedAt = parseInt(cached.headers.get('x-sw-cached-at') || '0', 10);
      if (Date.now() - cachedAt < IA_TTL) {
        return cached;
      }
      // Expirado — eliminar y propagar error
      await cache.delete(cacheKey);
    }
    throw err;
  }
}

async function enforceIALRU(cache, response, request) {
  try {
    await cache.put(request, response);
    const keys = await cache.keys();
    if (keys.length > IA_MAX_ENTRIES) {
      const toDelete = keys.length - IA_MAX_ENTRIES;
      for (let i = 0; i < toDelete; i++) {
        await cache.delete(keys[i]);
      }
    }
  } catch {
    // Silenciar errores de quota
  }
}

// --- CDN Images: Cache First ---
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
          .filter((name) => name !== CACHE_NAME && name !== IA_CACHE_NAME)
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
