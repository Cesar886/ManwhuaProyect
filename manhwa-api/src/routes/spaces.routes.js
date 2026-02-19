/**
 * Rutas para DigitalOcean Spaces - REST + SSE Híbrido
 * 
 * ARQUITECTURA:
 * - REST: Carga inicial rápida (/manhwas)
 * - SSE Stream: Carga inicial + actualizaciones (/stream) - LEGACY
 * - SSE Updates: Solo actualizaciones (/updates) - RECOMENDADO
 */

const express = require('express');
const router = express.Router();
const spacesController = require('../controllers/spaces.controller');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRole } = require('../middleware/authorize');
const { requireApiKeyOrAuth } = require('../middleware/apiKey');
const { validate } = require('../middleware/validate');
const { slugParam, chapterNumParam, paginationValidation } = require('../middleware/validators');

// ============================================
// RUTAS REST (carga inicial - RECOMENDADO)
// ============================================

/**
 * GET /api/spaces/manhwas
 * Lista todos los manhwas desde DigitalOcean Spaces (con cache)
 *
 * Usa cache en memoria con preload automático:
 * - Cache hit: ~1ms
 * - Cache miss: espera preload o carga directa desde Spaces
 * - Incluye capítulos por serie
 */
router.get('/manhwas', requireApiKeyOrAuth, validate(paginationValidation), spacesController.listManhwasFromDatabase);

/**
 * GET /api/spaces/manhwas/:slug
 * Obtiene detalles de una serie específica
 */
router.get('/manhwas/:slug', requireApiKeyOrAuth, validate(slugParam), spacesController.getManhwaFromSpaces);

/**
 * GET /api/spaces/manhwas/:slug/capitulo/:chapterNum/pages
 * Obtiene las páginas de un capítulo
 */
router.get('/manhwas/:slug/capitulo/:chapterNum/pages', requireApiKeyOrAuth, validate([...slugParam, ...chapterNumParam]), spacesController.getChapterPagesFromSpaces);

// ============================================
// RUTAS SSE (actualizaciones en tiempo real)
// ============================================

/**
 * GET /api/spaces/updates
 * SSE Stream SOLO para actualizaciones (RECOMENDADO)
 * 
 * Usar junto con GET /manhwas para arquitectura híbrida:
 * 1. Frontend carga datos via REST (/manhwas) - rápido
 * 2. Frontend conecta a SSE (/updates) - para recibir cambios
 * 
 * Eventos emitidos:
 * - connected: Confirmación de conexión
 * - heartbeat: Ping cada 30s
 * - new_chapter: Nuevo capítulo subido
 * - new_series: Nueva serie añadida
 * - update: Actualización genérica
 */
router.get('/updates', requireApiKeyOrAuth, spacesController.streamUpdatesOnly);

/**
 * GET /api/spaces/stream-progressive
 * SSE Stream PROGRESIVO para carga ultra-rápida (RECOMENDADO)
 * 
 * ARQUITECTURA HÍBRIDA - 3 CAPAS:
 * - CAPA 1 (Frontend): Skeletons inmediatos (0ms)
 * - CAPA 2 (Este endpoint): Metadata streaming (200-800ms)
 * - CAPA 3 (Frontend): Lazy loading imágenes (1-5s)
 * 
 * Eventos emitidos:
 * - connected: Confirmación + total estimado
 * - manhwa: Un manhwa individual
 * - manhwa-batch: Lote de manhwas
 * - progress: Mensaje de progreso
 * - complete: Streaming finalizado
 * - initial: Fallback con todos los datos (si hay cache)
 */
router.get('/stream-progressive', requireApiKeyOrAuth, spacesController.streamProgressiveManhwas);

/**
 * GET /api/spaces/stream
 * SSE Stream con carga inicial + actualizaciones (LEGACY)
 * 
 * ⚠️ DEPRECADO: Preferir /updates + REST /manhwas
 * Mantener para compatibilidad con frontend anterior
 */
router.get('/stream', requireApiKeyOrAuth, spacesController.streamUpdates);

// ============================================
// RUTAS PROTEGIDAS (admin/scraper)
// ============================================

/**
 * POST /api/spaces/webhook/sync
 * Webhook llamado por el scraper cuando hay nuevo contenido
 * Notifica a clientes SSE conectados
 */
router.post('/webhook/sync', (req, res, next) => {
    const secret = req.headers['x-webhook-secret'] || req.body?.secret;
    if (!process.env.WEBHOOK_SECRET || secret !== process.env.WEBHOOK_SECRET) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    next();
}, spacesController.syncWebhook);

/**
 * POST /api/spaces/sync-db
 * Sincroniza contenido de Spaces con la base de datos
 * Requiere autenticación de admin
 */
router.post('/sync-db', authenticate, requireRole('admin'), spacesController.syncToDatabase);

/**
 * GET /api/spaces/stats
 * Estadísticas del cache y conexiones SSE
 */
router.get('/stats', authenticate, requireRole('admin'), (req, res) => {
    res.json({
        success: true,
        cache: spacesController.getCacheStats(),
        sse: {
            updateClients: spacesController.getUpdateClientsCount()
        }
    });
});

module.exports = router;
