const allowedOrigins = [
  'https://manhwaimperial.site',
  'https://www.manhwaimperial.site',
  'http://localhost:3000',
  'http://localhost:5173'
];

// =====================================================================
// CAMBIO: Whitelist de User-Agents de motores de búsqueda legítimos.
// Googlebot, Bingbot, etc. NO envían Origin ni Referer en requests GET,
// por lo que el middleware original los bloqueaba con 403 en producción.
// Esto impedía la indexación de las 548+ páginas del sitio.
// =====================================================================
const ALLOWED_BOT_PATTERNS = [
  'Googlebot', 'Googlebot-Mobile', 'Googlebot-Image', 'Googlebot-Video',
  'AdsBot-Google', 'Mediapartners-Google', 'APIs-Google',
  'Storebot-Google', 'Google-InspectionTool',
  'Bingbot', 'BingPreview',
  'Slurp',              // Yahoo
  'DuckDuckBot',
  'Baiduspider',
  'YandexBot', 'YandexImages',
  'facebookexternalhit', // Facebook crawler (para Open Graph)
  'Twitterbot',          // Twitter/X card preview
  'LinkedInBot',
  'Discordbot',
  'WhatsApp',
  'TelegramBot',
  'Applebot',            // Apple/Siri
];

// Bots maliciosos/scraping que NO deben tener acceso libre
// NOTA: Bytespider (TikTok) fue removido de esta lista porque robots.txt lo permite.
// Si quieres bloquearlo, agrégalo aquí Y en robots.txt para consistencia.
const BLOCKED_BOT_PATTERNS = [
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot',
  'BLEXBot', 'PetalBot',
];

/**
 * Detecta si el User-Agent corresponde a un motor de búsqueda legítimo.
 * Retorna true solo si coincide con un bot permitido Y no es un bot bloqueado.
 */
const isAllowedSearchBot = (userAgent) => {
  if (!userAgent) return false;
  // Primero verificar si es un bot bloqueado
  if (BLOCKED_BOT_PATTERNS.some(bot => userAgent.includes(bot))) return false;
  // Luego verificar si es un bot permitido
  return ALLOWED_BOT_PATTERNS.some(bot => userAgent.includes(bot));
};

const requireValidOrigin = (req, res, next) => {
  // Allow internal requests with valid API key (e.g. Next.js SSR)
  const apiKey = req.headers['x-api-key'];
  if (apiKey && process.env.INTERNAL_API_KEY && apiKey === process.env.INTERNAL_API_KEY) {
    return next();
  }

  // CAMBIO: Permitir paso libre a crawlers de motores de búsqueda legítimos.
  // Sin esto, Googlebot recibe 403 porque no envía Origin ni Referer.
  const userAgent = req.headers['user-agent'] || '';
  if (isAllowedSearchBot(userAgent)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Allow requests with no origin/referer only in development/test
  if (process.env.NODE_ENV !== 'production' && !origin && !referer) {
    return next();
  }

  // 1. Strict Origin Check
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Invalid origin'
    });
  }

  // 2. Referer Check
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: Invalid referer'
        });
      }
    } catch (e) {
      // Malformed referer
      return res.status(403).json({
        success: false,
        message: 'Access denied: Malformed referer'
      });
    }
  }

  // Block completely empty headers in production
  if (process.env.NODE_ENV === 'production' && !origin && !referer) {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Missing origin headers'
    });
  }

  next();
};

module.exports = { requireValidOrigin, isAllowedSearchBot };
