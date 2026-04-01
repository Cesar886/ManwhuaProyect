/**
 * Controlador de Progreso de Lectura
 * Maneja la sincronización del progreso entre dispositivos
 */

const { query, transaction } = require('../config/database');
const { validateXpGrant, checkLevelUp, XP_CONFIG } = require('../utils/xpSystem');
const { detectXpFarming, validateProgressData, logXpEvent } = require('../middleware/xpSecurity');

/**
 * Guardar o actualizar progreso de lectura
 * POST /api/progress
 */
const saveProgress = async (req, res, next) => {
    try {
        const {
            slug,
            chapterNum,
            scrollPosition = 0,
            progress = 0,
            totalPages = 0,
            isCompleted = false,
            deviceId = null
        } = req.body;

        const userId = req.user.id;

        // VALIDACIÓN ROBUSTA DE DATOS
        const validation = validateProgressData({
            slug,
            chapterNum,
            scrollPosition,
            progress,
            totalPages,
            isCompleted
        });

        if (!validation.valid) {
            logXpEvent('validation_error', {
                userId,
                errors: validation.errors,
                data: { slug, chapterNum }
            });
            return res.status(400).json({
                success: false,
                message: 'Datos de progreso inválidos',
                errors: validation.errors
            });
        }

        // Buscar serie con manejo de error robusto
        const seriesResult = await query(
            'SELECT id FROM series WHERE slug = $1 AND deleted_at IS NULL',
            [slug]
        );

        if (seriesResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Serie no encontrada'
            });
        }

        const seriesId = seriesResult.rows[0].id;

        // Obtener o crear capítulo (los capítulos se sirven desde Spaces,
        // pero necesitamos un registro en la BD para el FK de reading_history)
        const chapterResult = await query(
            `INSERT INTO chapters (series_id, number, title, slug, is_published)
             VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (series_id, number) DO UPDATE SET series_id = chapters.series_id
             RETURNING id`,
            [seriesId, chapterNum, `Capítulo ${chapterNum}`, `capitulo-${chapterNum}`]
        );

        const chapterId = chapterResult.rows[0].id;

        // UPSERT: insertar o actualizar en una sola operación atómica
        // IMPORTANTE: first_read_at se preserva en UPDATE para calcular rachas correctamente
        const result = await query(
            `INSERT INTO reading_history
                (user_id, series_id, chapter_id, scroll_position, progress_percentage,
                 total_pages, is_completed, device_id, synced_at, read_at, first_read_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
             ON CONFLICT (user_id, chapter_id)
             DO UPDATE SET
                scroll_position = EXCLUDED.scroll_position,
                progress_percentage = EXCLUDED.progress_percentage,
                total_pages = EXCLUDED.total_pages,
                is_completed = CASE
                    WHEN reading_history.is_completed THEN true
                    ELSE EXCLUDED.is_completed
                END,
                device_id = EXCLUDED.device_id,
                synced_at = NOW(),
                read_at = NOW()
                -- first_read_at is intentionally NOT updated to preserve original read date
             RETURNING *`,
            [userId, seriesId, chapterId, scrollPosition, progress, totalPages, isCompleted, deviceId]
        );

        // Actualizar bookmark (UPSERT)
        await query(
            `INSERT INTO bookmarks (user_id, series_id, last_read_chapter_id, last_read_page, last_read_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (user_id, series_id)
             DO UPDATE SET
                last_read_chapter_id = $3,
                last_read_page = $4,
                last_read_at = NOW(),
                updated_at = NOW()`,
            [userId, seriesId, chapterId, Math.floor(progress)]
        );

        // Registrar dispositivo si se proporciona (fallo no crítico)
        if (deviceId) {
            try {
                await query(
                    `INSERT INTO user_devices (user_id, device_id, last_sync_at)
                     VALUES ($1, $2, NOW())
                     ON CONFLICT (user_id, device_id)
                     DO UPDATE SET last_sync_at = NOW()`,
                    [userId, deviceId]
                );
            } catch (deviceErr) {
                // No crítico: no interrumpir el guardado del progreso
            }
        }

        // ============================================
        // SISTEMA DE XP - DIFICULTAD EXTREMA
        // ============================================
        let xpGranted = null;
        let levelUpInfo = null;

        // Solo otorgar XP si el capítulo fue completado
        if (isCompleted) {
            try {
                const xpResult = await grantXpForChapterCompletion({
                    userId,
                    chapterId,
                    firstReadAt: result.rows[0].first_read_at,
                    wasAlreadyCompleted: result.rows[0].is_completed && result.rowCount === 0, // Ya existía completado
                    seriesSlug: slug,
                    chapterNum
                });

                xpGranted = xpResult.xpGranted;
                levelUpInfo = xpResult.levelUpInfo;
            } catch (xpError) {
                // No crítico: el progreso ya se guardó, el XP es secundario
                console.warn('⚠️ Error otorgando XP:', xpError.message);
            }
        }

        // ============================================
        // SISTEMA DE LOGROS (ACHIEVEMENTS)
        // ============================================
        let achievementsUnlocked = [];
        
        // Verificar y actualizar logros en background (no crítico)
        if (isCompleted) {
            try {
                const { updateMultipleAchievements } = require('./achievement.controller');
                const stats = await getUserBadgeStats(userId, req.user?.timezone);
                achievementsUnlocked = await updateMultipleAchievements(userId, stats);
            } catch (achievementError) {
                // No crítico: silenciar error
                console.warn('⚠️ Error actualizando logros:', achievementError.message);
            }
        }

        res.json({
            success: true,
            data: {
                progress: {
                    slug,
                    chapterNum,
                    scrollPosition,
                    progress,
                    totalPages,
                    isCompleted: result.rows[0].is_completed,
                    syncedAt: result.rows[0].synced_at
                },
                // Información de XP si se otorgó
                ...(xpGranted !== null && {
                    xp: {
                        granted: xpGranted,
                        levelUp: levelUpInfo?.leveledUp || false,
                        newLevel: levelUpInfo?.newLevel,
                        levelName: levelUpInfo?.levelName
                    }
                }),
                // Información de logros desbloqueados
                ...(achievementsUnlocked.length > 0 && {
                    achievements: achievementsUnlocked
                })
            }
        });

        // Emitir actualización de racha en tiempo real al usuario (fire-and-forget)
        calculateStreakForUser(userId)
            .then((streakData) => {
                const clients = req.app.locals.streakClients || [];
                const userClients = clients.filter(c => c.userId === userId);
                if (userClients.length === 0) return;

                const payload = `data: ${JSON.stringify(streakData)}\n\n`;
                for (const client of userClients) {
                    try { client.res.write(`event: streak-update\n${payload}`); } catch (_) { /* noop */ }
                }
            })
            .catch(() => { /* noop — no afecta la respuesta ya enviada */ });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener progreso de un capítulo específico
 * GET /api/progress/:slug/:chapterNum
 */
const getProgress = async (req, res, next) => {
    try {
        const { slug, chapterNum } = req.params;
        const userId = req.user.id;

        const result = await query(
            `SELECT rh.scroll_position, rh.progress_percentage, rh.total_pages,
                    rh.is_completed, rh.synced_at, rh.read_at, rh.device_id
             FROM reading_history rh
             JOIN series s ON rh.series_id = s.id
             JOIN chapters c ON rh.chapter_id = c.id
             WHERE rh.user_id = $1 AND s.slug = $2 AND c.number = $3
               AND s.deleted_at IS NULL`,
            [userId, slug, parseFloat(chapterNum)]
        );

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: { progress: null }
            });
        }

        const p = result.rows[0];

        res.json({
            success: true,
            data: {
                progress: {
                    scrollPosition: p.scroll_position,
                    progress: parseFloat(p.progress_percentage),
                    totalPages: p.total_pages,
                    isCompleted: p.is_completed,
                    syncedAt: p.synced_at,
                    readAt: p.read_at,
                    deviceId: p.device_id
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Sincronizar todo el progreso del usuario
 * GET /api/progress/sync
 */
const syncProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);

        const result = await query(
            `SELECT s.slug, c.number as chapter_num,
                    rh.scroll_position, rh.progress_percentage, rh.total_pages,
                    rh.is_completed, rh.synced_at, rh.read_at, rh.device_id
             FROM reading_history rh
             JOIN series s ON rh.series_id = s.id
             JOIN chapters c ON rh.chapter_id = c.id
             WHERE rh.user_id = $1
               AND s.deleted_at IS NULL
             ORDER BY rh.synced_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        res.json({
            success: true,
            data: {
                progress: result.rows.map(p => ({
                    slug: p.slug,
                    chapterNum: p.chapter_num,
                    scrollPosition: p.scroll_position,
                    progress: parseFloat(p.progress_percentage),
                    totalPages: p.total_pages,
                    isCompleted: p.is_completed,
                    syncedAt: p.synced_at,
                    readAt: p.read_at,
                    deviceId: p.device_id
                })),
                count: result.rows.length
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtener últimos capítulos leídos (para "Continuar leyendo")
 * GET /api/progress/recent
 */
const getRecentProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);

        // Subquery para obtener el capítulo más reciente de cada serie,
        // luego ordenar por fecha y limitar
        const result = await query(
            `SELECT sub.* FROM (
                SELECT DISTINCT ON (rh.series_id)
                    s.id as series_id, s.slug, s.title, s.cover_url,
                    c.id as chapter_id, c.number as chapter_num, c.title as chapter_title,
                    rh.scroll_position, rh.progress_percentage, rh.is_completed, rh.read_at
                FROM reading_history rh
                JOIN series s ON rh.series_id = s.id
                JOIN chapters c ON rh.chapter_id = c.id
                WHERE rh.user_id = $1
                  AND s.deleted_at IS NULL
                ORDER BY rh.series_id, rh.read_at DESC
             ) sub
             ORDER BY sub.read_at DESC
             LIMIT $2`,
            [userId, limit]
        );

        res.json({
            success: true,
            data: {
                recent: result.rows.map(r => ({
                    series: {
                        id: r.series_id,
                        slug: r.slug,
                        title: r.title,
                        coverUrl: r.cover_url
                    },
                    chapter: {
                        id: r.chapter_id,
                        number: r.chapter_num,
                        title: r.chapter_title
                    },
                    progress: parseFloat(r.progress_percentage),
                    isCompleted: r.is_completed,
                    readAt: r.read_at
                }))
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Eliminar progreso de un capítulo específico
 * DELETE /api/progress/:slug/:chapterNum
 */
const deleteProgress = async (req, res, next) => {
    try {
        const { slug, chapterNum } = req.params;
        const userId = req.user.id;

        await query(
            `DELETE FROM reading_history rh
             USING series s, chapters c
             WHERE rh.series_id = s.id
               AND rh.chapter_id = c.id
               AND rh.user_id = $1
               AND s.slug = $2
               AND c.number = $3`,
            [userId, slug, parseFloat(chapterNum)]
        );

        res.json({
            success: true,
            message: 'Progreso eliminado'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Helper interno — calcula la racha de un usuario sin pasar por HTTP
 * @param {string|number} userId
 * @returns {Promise<Object>} Datos de racha
 */
const calculateStreakForUser = async (userId) => {
    const result = await query(
        `WITH reading_days AS (
           SELECT DISTINCT (COALESCE(first_read_at, read_at) AT TIME ZONE 'UTC')::date AS day
           FROM reading_history
           WHERE user_id = $1
         ),
         today AS (
           SELECT (NOW() AT TIME ZONE 'UTC')::date AS d
         ),
         numbered AS (
           SELECT day,
             day + ROW_NUMBER() OVER (ORDER BY day DESC) * INTERVAL '1 day' AS grp
           FROM reading_days
         ),
         most_recent_grp AS (
           SELECT grp FROM numbered ORDER BY day DESC LIMIT 1
         ),
         streak_calc AS (
           SELECT
             COUNT(*) AS current_streak,
             MIN(day) AS streak_start,
             MAX(day) AS streak_end
           FROM numbered
           WHERE grp = (SELECT grp FROM most_recent_grp)
         ),
         today_check AS (
           SELECT EXISTS (
             SELECT 1 FROM reading_days, today
             WHERE reading_days.day >= today.d - INTERVAL '1 day'
           ) AS is_active
         ),
         all_streaks AS (
           SELECT grp, COUNT(*) AS streak_len
           FROM numbered
           GROUP BY grp
         ),
         stats AS (
           SELECT
             COUNT(*) AS total_days_read,
             (SELECT COALESCE(MAX(streak_len), 0) FROM all_streaks) AS max_streak
           FROM reading_days
         ),
         read_today AS (
           SELECT EXISTS (
             SELECT 1 FROM reading_days, today
             WHERE reading_days.day = today.d
           ) AS did_read
         )
         SELECT
           sc.current_streak,
           tc.is_active,
           sc.streak_start,
           sc.streak_end,
           s.total_days_read,
           s.max_streak,
           rt.did_read AS read_today,
           (SELECT COUNT(*) FROM reading_history WHERE user_id = $1) AS chapters_read
         FROM streak_calc sc, today_check tc, stats s, read_today rt`,
        [userId]
    );

    const row = result.rows[0];
    const streak = row?.is_active ? parseInt(row.current_streak) || 0 : 0;
    const maxStreak = Math.max(parseInt(row?.max_streak) || 0, streak);

    return {
        streak,
        maxStreak,
        readToday: row?.read_today || false,
        totalDaysRead: parseInt(row?.total_days_read) || 0,
        chaptersRead: parseInt(row?.chapters_read) || 0,
        streakStart: streak > 0 ? row?.streak_start : null,
        lastReadAt: row?.streak_end || null,
    };
};

/**
 * Obtener racha de lectura del usuario
 * GET /api/progress/streak
 * Usa first_read_at para cálculo preciso (no se puede manipular re-abriendo capítulos)
 */
const getStreak = async (req, res, next) => {
    try {
        const data = await calculateStreakForUser(req.user.id);
        res.json({ success: true, data });
    } catch (error) {
        next(error);
    }
};

/**
 * SSE — stream de actualizaciones de racha en tiempo real
 * GET /api/progress/stream
 */
const streamStreak = (req, res) => {
    const MAX_STREAK_CLIENTS = 500;
    const clients = req.app.locals.streakClients;

    if (clients.length >= MAX_STREAK_CLIENTS) {
        return res.status(503).json({ success: false, message: 'Demasiadas conexiones activas' });
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    // Heartbeat cada 30s para mantener la conexión viva
    res.write(': connected\n\n');

    const heartbeat = setInterval(() => {
        try { res.write(': heartbeat\n\n'); } catch (_) { /* noop */ }
    }, 30000);

    const client = {
        id: Date.now() + Math.random(),
        userId: req.user.id,
        res,
        connectedAt: Date.now(),
    };
    clients.push(client);

    req.on('close', () => {
        clearInterval(heartbeat);
        try {
            req.app.locals.streakClients = req.app.locals.streakClients.filter(c => c !== client);
        } catch (_) { /* noop */ }
    });
};

/**
 * Limpiar todo el progreso del usuario
 * DELETE /api/progress
 */
const clearAllProgress = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await query(
            'DELETE FROM reading_history WHERE user_id = $1',
            [userId]
        );

        res.json({
            success: true,
            message: 'Todo el progreso ha sido eliminado'
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    saveProgress,
    getProgress,
    syncProgress,
    getRecentProgress,
    getStreak,
    streamStreak,
    deleteProgress,
    clearAllProgress
};

/**
 * Obtener estadísticas del usuario para badges (uso interno)
 * Esta función es llamada por otros controladores para enriquecer datos de usuario
 */
/**
 * Validar que un string de timezone IANA sea seguro para usar en PostgreSQL.
 * Solo permite caracteres válidos: letras, dígitos, /, _, -, +
 */
const isValidTimezone = (tz) => {
    if (!tz || typeof tz !== 'string') return false;
    if (tz.length > 50) return false;
    return /^[A-Za-z0-9/_\-+]+$/.test(tz);
};

const getUserBadgeStats = async (userId, timezone = null) => {
    try {
        if (!userId) {
            return {
                streak: 0,
                totalChapters: 0,
                comments: 0,
                nightReads: 0,
                maxChaptersPerHour: 0,
                ratings: 0,
            };
        }

        // Usar timezone del usuario si es válido, sino UTC
        const tz = isValidTimezone(timezone) ? timezone : 'UTC';

        const result = await query(
            `WITH
            -- Racha actual
            reading_days AS (
                SELECT DISTINCT (COALESCE(first_read_at, read_at) AT TIME ZONE 'UTC')::date AS day
                FROM reading_history
                WHERE user_id = $1
            ),
            today AS (
                SELECT (NOW() AT TIME ZONE 'UTC')::date AS d
            ),
            numbered AS (
                SELECT day,
                    day + ROW_NUMBER() OVER (ORDER BY day DESC) * INTERVAL '1 day' AS grp
                FROM reading_days
            ),
            most_recent_grp AS (
                SELECT grp FROM numbered ORDER BY day DESC LIMIT 1
            ),
            streak_calc AS (
                SELECT COUNT(*) AS current_streak
                FROM numbered
                WHERE grp = (SELECT grp FROM most_recent_grp)
            ),
            today_check AS (
                SELECT EXISTS (
                    SELECT 1 FROM reading_days, today
                    WHERE reading_days.day >= today.d - INTERVAL '1 day'
                ) AS is_active
            ),

            -- Total de capítulos únicos leídos
            total_chapters AS (
                SELECT COUNT(DISTINCT chapter_id) as count
                FROM reading_history
                WHERE user_id = $1
            ),

            -- Total de comentarios
            total_comments AS (
                SELECT COUNT(*) as count
                FROM comments
                WHERE user_id = $1 AND status = 'visible'
            ),

            -- Noches distintas de lectura (00:00 - 05:00 en horario LOCAL del usuario)
            -- Usa el timezone del cliente para determinar madrugada correctamente
            night_reads AS (
                SELECT COUNT(DISTINCT (read_at AT TIME ZONE $2)::date) as count
                FROM reading_history
                WHERE user_id = $1
                AND EXTRACT(HOUR FROM (read_at AT TIME ZONE $2)) BETWEEN 0 AND 4
            ),

            -- Máximo de capítulos en 1 hora
            max_per_hour AS (
                SELECT COALESCE(MAX(hourly_count), 0) as count
                FROM (
                    SELECT COUNT(*) as hourly_count
                    FROM reading_history
                    WHERE user_id = $1
                    GROUP BY DATE_TRUNC('hour', read_at)
                ) subq
            ),

            -- Total de calificaciones del usuario (logro Primera Estrella)
            total_ratings AS (
                SELECT COUNT(*) as count
                FROM chapter_votes
                WHERE user_id = $1
            )

            SELECT
                CASE WHEN tc.is_active THEN sc.current_streak ELSE 0 END as streak,
                tch.count as total_chapters,
                tco.count as comments,
                nr.count as night_reads,
                mph.count as max_chapters_per_hour,
                tr.count as ratings
            FROM streak_calc sc, today_check tc, total_chapters tch,
                 total_comments tco, night_reads nr, max_per_hour mph, total_ratings tr`,
            [userId, tz]
        );

        const row = result.rows[0];

        return {
            streak: parseInt(row?.streak) || 0,
            totalChapters: parseInt(row?.total_chapters) || 0,
            comments: parseInt(row?.comments) || 0,
            nightReads: parseInt(row?.night_reads) || 0,
            maxChaptersPerHour: parseInt(row?.max_chapters_per_hour) || 0,
            ratings: parseInt(row?.ratings) || 0,
        };
    } catch (error) {
        console.error('Error getting user badge stats:', error);
        return {
            streak: 0,
            totalChapters: 0,
            comments: 0,
            nightReads: 0,
            maxChaptersPerHour: 0,
            ratings: 0,
        };
    }
};

/**
 * Otorgar XP por completar un capítulo
 * Sistema de validación EXTREMADAMENTE restrictivo para evitar spam y farming
 * CON DETECCIÓN DE PATRONES SOSPECHOSOS
 * 
 * @param {object} params
 * @param {string} params.userId - ID del usuario
 * @param {string} params.chapterId - ID del capítulo
 * @param {Date} params.firstReadAt - Timestamp de primera lectura
 * @param {boolean} params.wasAlreadyCompleted - Si ya había completado antes
 * @param {string} params.seriesSlug - Slug de la serie
 * @param {number} params.chapterNum - Número de capítulo
 * @returns {Promise<object>} { xpGranted, levelUpInfo }
 */
const grantXpForChapterCompletion = async ({ 
    userId, 
    chapterId, 
    firstReadAt, 
    wasAlreadyCompleted,
    seriesSlug,
    chapterNum 
}) => {
    // Usar transacción para garantizar consistencia y permitir rollback
    return await transaction(async (client) => {
        try {
            // 0. DETECCIÓN DE FARMING - Verificar antes de otorgar XP
            const farmingCheck = await detectXpFarming(userId);
            
            if (farmingCheck.isSuspicious) {
                logXpEvent('farming_detected', {
                    userId,
                    severity: farmingCheck.severity,
                    reason: farmingCheck.reason,
                    details: farmingCheck.details,
                    chapterId,
                    seriesSlug,
                    chapterNum
                });

                // Si es severidad alta, bloquear otorgamiento
                if (farmingCheck.severity === 'high') {
                    logXpEvent('xp_denied', {
                        userId,
                        reason: 'Farming detectado (severidad alta)',
                        details: farmingCheck.details
                    });

                    return {
                        xpGranted: 0,
                        levelUpInfo: null,
                        reason: 'Actividad sospechosa detectada. Contacta a soporte si crees que es un error.',
                        blocked: true
                    };
                }

                // Severidad media/baja: solo logging, permitir continuar
                console.warn(`⚠️ Actividad sospechosa (${farmingCheck.severity}) para usuario ${userId}: ${farmingCheck.reason}`);
            }

            // 1. Obtener XP y nivel actual del usuario
            const userResult = await client.query(
                'SELECT experience, level FROM users WHERE id = $1',
                [userId]
            );
            
            if (userResult.rows.length === 0) {
                throw new Error('Usuario no encontrado');
            }
            
            const currentXp = parseInt(userResult.rows[0].experience) || 0;
            const currentLevel = parseInt(userResult.rows[0].level) || 1;
            
            // 2. Calcular tiempo que pasó leyendo (desde first_read_at hasta ahora)
            const now = new Date();
            const firstRead = new Date(firstReadAt);
            const timeSpentSeconds = Math.floor((now - firstRead) / 1000);
            
            // Validación de sanidad: no aceptar tiempos negativos o excesivos
            if (timeSpentSeconds < 0) {
                throw new Error('Tiempo de lectura negativo detectado');
            }
            
            if (timeSpentSeconds > 86400) { // Más de 24 horas en un capítulo
                logXpEvent('xp_denied', {
                    userId,
                    reason: 'Tiempo de lectura excesivo (>24h)',
                    timeSpentSeconds
                });
                return {
                    xpGranted: 0,
                    levelUpInfo: null,
                    reason: 'Tiempo de lectura inválido'
                };
            }
            
            // 3. Obtener XP ganado hoy
            const dailyXpResult = await client.query(
                `SELECT COALESCE(SUM(xp_earned), 0) as daily_xp
                 FROM user_xp_daily
                 WHERE user_id = $1 AND date = CURRENT_DATE`,
                [userId]
            );
            
            const dailyXpEarned = parseInt(dailyXpResult.rows[0]?.daily_xp) || 0;
            
            // 4. Validar si se puede otorgar XP (anti-spam + límites)
            const validation = validateXpGrant({
                dailyXpEarned,
                timeSpentSeconds,
                alreadyCompleted: wasAlreadyCompleted
            });
            
            // Si no se puede otorgar, retornar sin XP
            if (!validation.canGrant) {
                logXpEvent('xp_denied', {
                    userId,
                    reason: validation.reason,
                    chapterId,
                    seriesSlug,
                    chapterNum,
                    timeSpentSeconds,
                    dailyXpEarned
                });

                return {
                    xpGranted: 0,
                    levelUpInfo: null,
                    reason: validation.reason
                };
            }
            
            const xpToGrant = validation.xpToGrant;
            
            // 5. Actualizar experience y level del usuario
            const newXp = currentXp + xpToGrant;
            const levelUpCheck = checkLevelUp(currentXp, newXp);
            
            await client.query(
                `UPDATE users 
                 SET experience = $1, 
                     level = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [newXp, levelUpCheck.newLevel, userId]
            );
            
            // 6. Registrar en historial de XP (auditoría)
            await client.query(
                `INSERT INTO user_xp_history 
                    (user_id, chapter_id, xp_gained, reason, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    userId,
                    chapterId,
                    xpToGrant,
                    'chapter_complete',
                    JSON.stringify({
                        seriesSlug,
                        chapterNum,
                        timeSpentSeconds,
                        dailyXpBefore: dailyXpEarned,
                        timestamp: new Date().toISOString()
                    })
                ]
            );
            
            // 7. Actualizar contador diario (UPSERT)
            await client.query(
                `INSERT INTO user_xp_daily (user_id, date, xp_earned, chapters_read)
                 VALUES ($1, CURRENT_DATE, $2, 1)
                 ON CONFLICT (user_id, date)
                 DO UPDATE SET
                     xp_earned = user_xp_daily.xp_earned + $2,
                     chapters_read = user_xp_daily.chapters_read + 1,
                     updated_at = NOW()`,
                [userId, xpToGrant]
            );
            
            // 8. Logging de evento exitoso
            logXpEvent('xp_granted', {
                userId,
                xpGranted: xpToGrant,
                newTotalXp: newXp,
                dailyXpTotal: dailyXpEarned + xpToGrant,
                timeSpentSeconds,
                chapterId,
                seriesSlug,
                chapterNum
            });

            // 9. Si hubo level up, logging especial
            if (levelUpCheck.leveledUp) {
                logXpEvent('level_up', {
                    userId,
                    oldLevel: levelUpCheck.oldLevel,
                    newLevel: levelUpCheck.newLevel,
                    levelName: levelUpCheck.levelName,
                    totalXp: newXp
                });
            }
            
            return {
                xpGranted: xpToGrant,
                levelUpInfo: levelUpCheck,
                newTotalXp: newXp,
                dailyXpTotal: dailyXpEarned + xpToGrant,
                timeSpentSeconds
            };

        } catch (error) {
            // Logging detallado del error
            console.error('❌ Error crítico en grantXpForChapterCompletion:', {
                error: error.message,
                stack: error.stack,
                userId,
                chapterId,
                seriesSlug,
                chapterNum
            });

            logXpEvent('xp_error', {
                userId,
                error: error.message,
                chapterId,
                seriesSlug,
                chapterNum
            });

            // Re-throw para que la transacción haga rollback
            throw error;
        }
    });
};

module.exports = {
    saveProgress,
    getProgress,
    syncProgress,
    getRecentProgress,
    getStreak,
    streamStreak,
    deleteProgress,
    clearAllProgress,
    getUserBadgeStats,  // Exportar para uso en otros controladores
    grantXpForChapterCompletion  // Exportar para testing
};
