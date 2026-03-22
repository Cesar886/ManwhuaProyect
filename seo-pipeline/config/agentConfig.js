/**
 * IMPERIAL-AGENT v3: Configuracion del Agente Autonomo SEO/GEO
 *
 * Umbrales, limites, costos y parametros de decision.
 * Todos los valores son configurables via .env con defaults razonables.
 */

const AGENT = {
  // Identidad
  NAME: 'IMPERIAL-AGENT-v3',
  VERSION: '3.0.0',

  // Umbral de confianza para publicacion directa vs draft
  CONFIDENCE_THRESHOLD: parseFloat(process.env.AI_CONFIDENCE_THRESHOLD) || 0.75,

  // OpenAI API (GPT-4o)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
  OPENAI_MODEL: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o',
  OPENAI_MAX_TOKENS: parseInt(process.env.AI_MAX_TOKENS) || 4096,
  OPENAI_TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE) || 0.3,

  // Control de costos mensual
  MONTHLY_LIMIT_USD: parseFloat(process.env.OPENAI_MONTHLY_LIMIT_USD) || 20,
  PAUSE_AT_PCT: parseFloat(process.env.OPENAI_PAUSE_AT_PCT) || 80,

  // CMS API
  CMS_API_BASE: process.env.CMS_API_BASE || 'http://localhost:3000/api',
  CMS_API_KEY: process.env.CMS_API_KEY || '',

  // Admin CMS — destino de reportes
  ADMIN_REPORTS_DIR: process.env.ADMIN_REPORTS_DIR || '/home/daniel/ManhwaImperialAdmin/reports',

  // Limites por modulo
  LIMITS: {
    MAX_TITLES_PER_RUN: parseInt(process.env.MAX_TITLES_PER_RUN) || 20,
    MAX_PAGES_PER_RUN: parseInt(process.env.MAX_PAGES_PER_RUN) || 5,
    MAX_SCHEMAS_PER_RUN: parseInt(process.env.MAX_SCHEMAS_PER_RUN) || 10,
    MAX_GEO_PER_RUN: parseInt(process.env.MAX_GEO_PER_RUN) || 10,
    MAX_INTERNAL_LINKS_PER_RUN: parseInt(process.env.MAX_INTERNAL_LINKS_PER_RUN) || 10,
  },

  // Filtros para seleccion de candidatos
  FILTERS: {
    // Quick Wins: posicion 4-15
    QW_MIN_POSITION: 4,
    QW_MAX_POSITION: 15,
    QW_MIN_IMPRESSIONS: 100,
    // Content Gaps
    CG_MIN_IMPRESSIONS: 50,
    // Prioridades Quick Wins
    QW_ALTA_MAX_POS: 8,
    QW_ALTA_MIN_IMP: 300,
    QW_MEDIA_MAX_POS: 12,
    QW_MEDIA_MIN_IMP: 150,
    QW_BAJA_MAX_POS: 15,
    QW_BAJA_MIN_IMP: 100,
    // Content Gaps prioridades
    CG_ALTA_MIN_IMP: 400,
    CG_MEDIA_MIN_IMP: 150,
  },

  // Site URL
  SITE_URL: process.env.GSC_SITE_URL || 'https://manhwaimperial.site',

  // Notificaciones de drafts (en admin CMS)
  NOTIFY_ON_DRAFT: process.env.NOTIFY_ON_DRAFT !== 'false',

  // Redes sociales (para schema Organization)
  SOCIAL_LINKS: (process.env.SITE_SOCIAL_LINKS || '').split(',').map(s => s.trim()).filter(Boolean),

  // CURATOR-AGENT v1
  CURATOR: {
    MAX_PAGES_PER_RUN: parseInt(process.env.CURATOR_MAX_PAGES_PER_RUN) || 15,
    MIN_CONFIDENCE: parseFloat(process.env.CURATOR_MIN_CONFIDENCE) || 0.80,
    MIN_IMPRESSIONS: parseInt(process.env.CURATOR_MIN_IMPRESSIONS) || 200,
    MEASURE_AFTER_DAYS: parseInt(process.env.CURATOR_MEASURE_AFTER_DAYS) || 14,
    COOLDOWN_DAYS: 28, // No recurar en 4 semanas
  },

  // AB-TESTER v1
  AB_TESTER: {
    MAX_CONCURRENT_TESTS: parseInt(process.env.AB_MAX_CONCURRENT_TESTS) || 10,
    MIN_SESSIONS_TO_DECIDE: parseInt(process.env.AB_MIN_SESSIONS_TO_DECIDE) || 50,
    TEST_DURATION_DAYS: parseInt(process.env.AB_TEST_DURATION_DAYS) || 14,
    ABORT_CTR_DROP_PCT: parseInt(process.env.AB_ABORT_CTR_DROP_PCT) || 30,
  },

  // GEO: patrones de queries tipo pregunta
  GEO_QUERY_PATTERNS: [
    'cual', 'que', 'como', 'donde', 'recomienda', 'mejores', 'top',
    'ranking', 'es bueno', 'vale la pena', 'parecido a', 'similar a',
    'donde leer', 'leer online',
  ],
}

module.exports = { AGENT }
