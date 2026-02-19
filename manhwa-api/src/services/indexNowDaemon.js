/**
 * IndexNow Daemon para Bing/Yandex/DuckDuckGo
 * Envía automáticamente las URLs nuevas/actualizadas cada 6 horas.
 * Mismo patrón que googleIndexing.js
 */

const fs   = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const INDEXNOW_KEY  = 'f2cdd862b4624457846d2d3e59f308a8';
const INDEXNOW_API  = 'https://api.indexnow.org/IndexNow';
const SITE_URL      = process.env.NEXT_PUBLIC_SITE_URL || 'https://manhwaimperial.site';
const API_BASE      = process.env.NEXT_PUBLIC_API_URL_PROD || process.env.NEXT_PUBLIC_API_URL_LOCAL || 'http://localhost:3000/api';
const API_KEY       = process.env.INTERNAL_API_KEY || '';

const DAEMON_INTERVAL = 6 * 60 * 60 * 1000;   // 6 horas
const INITIAL_DELAY   = 60 * 1000;             // 60s tras arrancar (offset con Google que usa 30s)
const RECENT_DAYS     = 14;
const BATCH_SIZE      = 10000;

const HISTORY_PATH = path.join(__dirname, '..', '..', 'data', 'indexnow-history.json');

let daemonTimer      = null;
let initialDelayTimer = null;

// ============================================
// HISTORIAL (en memoria + disco)
// ============================================

let historyCache = null;

function loadHistory() {
    if (historyCache) return historyCache;
    try {
        if (fs.existsSync(HISTORY_PATH)) {
            historyCache = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'));
            if (!historyCache.submittedUrls || typeof historyCache.submittedUrls !== 'object') {
                historyCache = { submittedUrls: {}, lastDaemonRun: null };
            }
            return historyCache;
        }
    } catch (err) {
        logger.error('[IndexNow] Error leyendo historial:', err.message);
    }
    historyCache = { submittedUrls: {}, lastDaemonRun: null };
    return historyCache;
}

function saveHistory() {
    if (!historyCache) return;
    try {
        const dir = path.dirname(HISTORY_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const tmp = HISTORY_PATH + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(historyCache, null, 2), 'utf-8');
        fs.renameSync(tmp, HISTORY_PATH);
    } catch (err) {
        logger.error('[IndexNow] Error guardando historial:', err.message);
    }
}

function isUrlSubmitted(url) {
    return !!loadHistory().submittedUrls[url];
}

function markUrlsSubmitted(urls) {
    const history = loadHistory();
    const now = new Date().toISOString();
    for (const url of urls) {
        history.submittedUrls[url] = now;
    }
}

// ============================================
// OBTENER URLs RECIENTES
// ============================================

async function fetchRecentUrls() {
    const res = await fetch(`${API_BASE}/spaces/manhwas`, {
        headers: {
            'Accept': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {})
        }
    });

    if (!res.ok) throw new Error(`API ${res.status}`);

    const json  = await res.json();
    const series = json.data?.series || json.series || [];

    const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
    const urls = [];

    for (const s of series) {
        if (!s.slug) continue;

        const updatedAt = new Date(s.lastUpdated || s.updatedAt || 0).getTime();
        const isRecent  = updatedAt >= recentCutoff;

        if (!isRecent) continue;

        // URL de la serie
        const seriesUrl = `${SITE_URL}/manhwa/${s.slug}`;
        if (!isUrlSubmitted(seriesUrl)) urls.push(seriesUrl);

        // Último capítulo de la serie (prioridad alta)
        const count = s.chapterCount || 0;
        if (count > 0) {
            const chapterUrl = `${SITE_URL}/manhwa/${s.slug}/capitulo/${count}`;
            if (!isUrlSubmitted(chapterUrl)) urls.push(chapterUrl);
        }
    }

    return urls;
}

// ============================================
// ENVÍO A INDEXNOW
// ============================================

async function submitBatch(urls) {
    const res = await fetch(INDEXNOW_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
            host:        new URL(SITE_URL).hostname,
            key:         INDEXNOW_KEY,
            keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
            urlList:     urls
        })
    });
    return res.status;
}

// ============================================
// CICLO DEL DAEMON
// ============================================

async function runDaemonCycle() {
    logger.info('[IndexNow] Daemon: iniciando ciclo...');

    let urls;
    try {
        urls = await fetchRecentUrls();
    } catch (err) {
        logger.error('[IndexNow] Daemon: error obteniendo URLs:', err.message);
        return;
    }

    if (urls.length === 0) {
        logger.info('[IndexNow] Daemon: no hay URLs nuevas que enviar');
        loadHistory().lastDaemonRun = new Date().toISOString();
        saveHistory();
        return;
    }

    logger.info(`[IndexNow] Daemon: ${urls.length} URLs nuevas encontradas`);

    let totalOk = 0;
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch  = urls.slice(i, i + BATCH_SIZE);
        const status = await submitBatch(batch);
        const ok     = status === 200 || status === 202;

        if (ok) {
            markUrlsSubmitted(batch);
            totalOk += batch.length;
            logger.info(`[IndexNow] Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} URLs enviadas (HTTP ${status})`);
        } else {
            logger.error(`[IndexNow] Lote ${Math.floor(i / BATCH_SIZE) + 1}: error HTTP ${status}`);
        }
    }

    const history = loadHistory();
    history.lastDaemonRun = new Date().toISOString();
    saveHistory();

    logger.info(`[IndexNow] Daemon: ciclo completado. ${totalOk}/${urls.length} URLs enviadas a Bing`);
}

// ============================================
// API PÚBLICA
// ============================================

function startIndexNowDaemon() {
    loadHistory();
    logger.info(`[IndexNow] Daemon iniciado. Intervalo: ${DAEMON_INTERVAL / 3600000}h`);

    initialDelayTimer = setTimeout(() => {
        initialDelayTimer = null;
        runDaemonCycle();
    }, INITIAL_DELAY);

    daemonTimer = setInterval(runDaemonCycle, DAEMON_INTERVAL);
}

function stopIndexNowDaemon() {
    if (initialDelayTimer) { clearTimeout(initialDelayTimer);  initialDelayTimer = null; }
    if (daemonTimer)       { clearInterval(daemonTimer);       daemonTimer = null; }
    saveHistory();
    logger.info('[IndexNow] Daemon detenido.');
}

module.exports = { startIndexNowDaemon, stopIndexNowDaemon };
