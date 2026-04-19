/**
 * IMPERIAL-AGENT v3: Configuracion centralizada de APIs (GSC + BWT)
 */

const path = require('path')

// Google Search Console API
const GSC = {
  API_BASE: 'https://searchconsole.googleapis.com/webmasters/v3',
  SCOPE: 'https://www.googleapis.com/auth/webmasters.readonly',
  INDEXING_SCOPE: 'https://indexing.googleapis.com/v3/urlNotifications:publish',
  SITE_URL: process.env.GSC_SITE_URL || 'https://manhwaimperial.site',
  CREDENTIALS_PATH: (() => {
    const raw = process.env.GOOGLE_CREDENTIALS_PATH || 'service-account.json'
    return path.isAbsolute(raw) ? raw : path.resolve(__dirname, '..', raw)
  })(),
  MAX_ROWS: 25000,
  DATA_DELAY_DAYS: 3,
  // Rate limits
  INDEXING_DAILY_LIMIT: 200,
}

// Bing Webmaster Tools API
const BWT = {
  API_BASE: 'https://ssl.bing.com/webmaster/api.svc/json',
  SITE_URL: process.env.BWT_SITE_URL || process.env.GSC_SITE_URL || 'https://manhwaimperial.site',
  API_KEY: process.env.BWT_API_KEY || '',
  ENDPOINTS: {
    QUERY_STATS: '/GetQueryStats',
    PAGE_STATS: '/GetPageStats',
    RANK_STATS: '/GetRankAndTrafficStats',
    CRAWL_STATS: '/GetCrawlStats',
    URL_INFO: '/GetUrlInfo',
    SUBMIT_URL: '/SubmitUrl',
    SUBMIT_URL_BATCH: '/SubmitUrlBatch',
    LINK_COUNTS: '/GetLinkCounts',
    URL_LINKS: '/GetUrlLinks',
    SITE_SCAN: '/GetScanDetails',
    // v2: Copilot stats
    COPILOT_STATS: '/GetCopilotClickStats',
  },
  RATE_LIMIT_RPS: 5,
  RATE_LIMIT_DAILY: 50000,
  // IndexNow
  INDEXNOW_DAILY_LIMIT: 10000,
}

// IndexNow
const INDEX_NOW = {
  ENDPOINT: 'https://api.indexnow.org/indexnow',
  KEY: process.env.INDEXNOW_KEY || '',
  KEY_LOCATION: process.env.INDEXNOW_KEY_LOCATION || '',
}

// Competidores
const COMPETITORS = (process.env.BWT_COMPETITORS || 'lectortmo.com,mangatmo.com,inmanga.com,manhuascan.com')
  .split(',')
  .map(c => c.trim())
  .filter(Boolean)

module.exports = { GSC, BWT, INDEX_NOW, COMPETITORS }
