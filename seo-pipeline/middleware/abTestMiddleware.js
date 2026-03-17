/**
 * AB-TESTER v1: Express Middleware para A/B Testing
 *
 * Se instala en el Express app de manhwa-api para servir
 * variante A o B segun cookie de sesion.
 *
 * Principio de NO CLOAKING:
 *   Googlebot y Bingbot SIEMPRE reciben variante A (original).
 *   Usuarios reales reciben A o B segun cookie 50/50.
 *
 * Uso:
 *   const { abTestMiddleware } = require('../../seo-pipeline/middleware/abTestMiddleware')
 *   app.use(abTestMiddleware(pool))
 *
 * Requiere: cookie-parser ya instalado en Express
 */

const COOKIE_NAME = 'ab_variant'
const COOKIE_MAX_AGE = 14 * 24 * 60 * 60 * 1000 // 14 dias

// ── Deteccion de bots ──

const BOT_PATTERNS = [
  'googlebot', 'bingbot', 'bingpreview', 'msnbot',
  'yandexbot', 'baiduspider', 'duckduckbot',
  'facebookexternalhit', 'facebot', 'twitterbot',
  'linkedinbot', 'slackbot', 'whatsapp',
  'applebot', 'petalbot', 'semrushbot', 'ahrefsbot',
  'dotbot', 'rogerbot', 'screaming frog',
  'chatgpt-user', 'gptbot', 'claudebot',
]

function isBot(userAgent) {
  if (!userAgent) return false
  const ua = userAgent.toLowerCase()
  return BOT_PATTERNS.some(bot => ua.includes(bot))
}

// ── Asignar variante por cookie ──

function getVariant(req, res) {
  // Bots siempre reciben A
  if (isBot(req.headers['user-agent'])) {
    return 'a'
  }

  // Cookie existente
  const existing = req.cookies?.[COOKIE_NAME]
  if (existing === 'a' || existing === 'b') {
    return existing
  }

  // Nueva sesion: 50/50
  const variant = Math.random() < 0.5 ? 'a' : 'b'
  res.cookie(COOKIE_NAME, variant, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return variant
}

// ── GA4 dataLayer snippet ──

function ga4Snippet(pageId, variant, slug) {
  return `<script>
window.dataLayer = window.dataLayer || [];
window.dataLayer.push({
  'event': 'ab_test_view',
  'ab_test_id': 'curator_${pageId}',
  'ab_variant': '${variant}',
  'ab_page_url': '${slug}'
});
</script>`
}

// ── Middleware principal ──

/**
 * Crea el middleware A/B test para Express.
 *
 * @param {Object} pool - mysql2 connection pool
 * @returns {Function} Express middleware
 */
function abTestMiddleware(pool) {
  if (!pool) {
    console.warn('[AB-TEST] No se proporciono pool de DB. Middleware desactivado.')
    return (req, res, next) => next()
  }

  return async (req, res, next) => {
    // Solo interceptar GETs a paginas de contenido
    if (req.method !== 'GET') return next()

    // Extraer slug de la URL (ej: /manhwa/solo-leveling -> solo-leveling)
    const slugMatch = req.path.match(/^\/(manhwa|obra|lista|top|mejores|resena|review|genero|tag)\/([^/]+)\/?$/)
    if (!slugMatch) return next()

    const slug = slugMatch[2]

    try {
      // Verificar si esta pagina tiene A/B test activo
      const [rows] = await pool.query(
        `SELECT id, html_variant_a, html_variant_b, ab_test_active
         FROM pages WHERE slug = ? AND ab_test_active = TRUE LIMIT 1`,
        [slug]
      )

      // Si no hay test activo, continuar normalmente
      if (!rows || rows.length === 0 || !rows[0].ab_test_active) {
        return next()
      }

      const page = rows[0]
      const variant = getVariant(req, res)

      // Seleccionar HTML segun variante
      const html = variant === 'b' && page.html_variant_b
        ? page.html_variant_b
        : page.html_variant_a

      // Incrementar contador de sesiones (fire-and-forget)
      const sessionCol = variant === 'b'
        ? 'ab_test_variant_b_sessions'
        : 'ab_test_variant_a_sessions'
      pool.query(
        `UPDATE pages SET ${sessionCol} = ${sessionCol} + 1 WHERE id = ?`,
        [page.id]
      ).catch(() => { /* no bloquear */ })

      // Inyectar tracking GA4 y almacenar en res.locals para el renderer
      res.locals.abTest = {
        active: true,
        variant,
        contentHtml: html,
        ga4Snippet: ga4Snippet(page.id, variant, slug),
        pageId: page.id,
      }

      return next()
    } catch (err) {
      // Error silencioso: no romper la pagina por un fallo de A/B
      console.error(`[AB-TEST] Error: ${err.message}`)
      return next()
    }
  }
}

/**
 * Helper para el template renderer:
 * Si hay A/B test activo, usa res.locals.abTest.contentHtml
 * en vez del content_html normal de la DB.
 *
 * Ejemplo en el controller de paginas:
 *   const content = res.locals.abTest?.active
 *     ? res.locals.abTest.contentHtml
 *     : page.content_html
 */

module.exports = {
  abTestMiddleware,
  isBot,
  getVariant,
  ga4Snippet,
  COOKIE_NAME,
}
