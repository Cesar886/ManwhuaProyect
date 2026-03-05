// Service Worker — Cache First para imágenes de capítulos (solo dominios propios)
const CACHE_NAME = 'manhwa-images-v5';
const MAX_ENTRIES = 500;
const IA_API_ORIGIN = 'ai.manhwaimperial.site';
// Orígenes propios que NO deben cachearse aquí (Next.js ya los maneja)
const SELF_ORIGIN = self.location.origin;

// Solo cachear imágenes de nuestros propios dominios de almacenamiento
// Imágenes externas (imageshack, etc.) se dejan pasar sin interceptar
// porque esos hosts no permiten CORS desde un Service Worker
const OWN_IMAGE_ORIGINS = [
  'manwhaimperialstorage.sfo3.digitaloceanspaces.com',
  'manhwaimperialstorage.sfo3.digitaloceanspaces.com',
  'nyc3.digitaloceanspaces.com',
];

function isOwnImageUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return OWN_IMAGE_ORIGINS.some(origin => hostname.includes(origin));
  } catch {
    return false;
  }
}

// Interceptar requests
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // IA API — dejar que el navegador maneje CORS directamente (no interceptar)
  if (request.url.includes(IA_API_ORIGIN)) return;

  // Requests del propio sitio — Next.js las maneja
  if (request.url.startsWith(SELF_ORIGIN)) return;

  // Solo procesar imágenes de NUESTROS dominios propios
  // Las imágenes externas (imageshack, etc.) se dejan pasar sin interceptar
  // para evitar errores CORS ya que esos hosts no envían headers CORS
  if (!isOwnImageUrl(request.url)) return;

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
    // Nuestros Spaces tienen CORS configurado, podemos usar modo 'cors'
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      enforceLRU(cache, clone, request);
    }
    return response;
  } catch (err) {
    throw err;
  }
}

async function enforceLRU(cache, response, request) {
  try {
    await cache.put(request, response);
    const keys = await cache.keys();
    if (keys.length > MAX_ENTRIES) {
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
