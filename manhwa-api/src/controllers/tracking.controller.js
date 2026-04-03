/**
 * Controlador de Tracking de Comportamiento
 * 
 * Responsabilidades:
 * - Recibir eventos de tracking del cliente
 * - Validar integridad de datos
 * - Guardar eventos raw en BD (asincrónico, <100ms)
 * - Actualizar agregaciones (géneros, tropos, progreso)
 * - Detectar eventos especiales (abandono, relectura, etc)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { createHash } = require('crypto');

// ============================================
// CONSTANTES
// ============================================
const ABANDONMENT_THRESHOLD_DAYS = 7;        // Considerar abandono después de 7 días
const SESSION_TIMEOUT_MINUTES = 30;          // Timeout de sesión (inactividad)
const MAX_SCROLL_DEPTH = 100;                // Máximo para scroll depth %

// ============================================
// 1. REGISTRAR EVENTO RAW DE COMPORTAMIENTO
// ============================================
exports.trackEvent = async (req, res) => {
    try {
        const user_id = req.user.id;
        const {
            event_type,
            work_id,
            chapter_id,
            session_id,
            user_agent,
            event_metadata = {}
        } = req.body;

        // Validaciones mínimas
        if (!event_type || !['page_load', 'scroll', 'chapter_change', 'session_start', 
            'session_end', 'tab_close', 'inactivity', 'progress_update'].includes(event_type)) {
            return res.status(400).json({ error: 'Invalid event_type' });
        }

        // Hash del user agent (no guardar completo por privacy)
        const userAgentHash = user_agent 
            ? createHash('sha256').update(user_agent).digest('hex').substring(0, 64)
            : null;

        // Insertar evento raw de forma **NO BLOQUEANTE**
        // Usar insertión asincrónica sin await en el response
        const sql = `
            INSERT INTO user_behavior_events 
            (user_id, work_id, chapter_id, event_type, event_metadata, session_id, user_agent_hash)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id
        `;
        
        query(sql, [
            user_id,
            work_id || null,
            chapter_id || null,
            event_type,
            JSON.stringify(event_metadata),
            session_id,
            userAgentHash
        ]).catch(err => {
            logger.error('Error inserting behavior event:', err);
        });

        // Responder inmediatamente (sin esperar inserción)
        res.json({ 
            success: true, 
            message: 'Event queued',
            timestamp: new Date().toISOString()
        });

        // Procesar lógica de agregación EN BACKGROUND (no bloquea response)
        // Esto permite response <100ms mientras se actualiza agregación
        if (work_id && chapter_id) {
            processEventAggregation(user_id, work_id, chapter_id, event_type, event_metadata);
        }

    } catch (error) {
        logger.error('Error in trackEvent:', error);
        res.status(500).json({ error: 'Tracking failed' });
    }
};


// ============================================
// 2. ACTUALIZAR SESIÓN DE LECTURA
// ============================================
exports.updateReadingSession = async (req, res) => {
    try {
        const user_id = req.user.id;
        const {
            work_id,
            chapter_id,
            duration_seconds,
            scroll_depth_percent,
            interactions_count,
            is_completed,
            exit_reason
        } = req.body;

        // Validaciones
        if (!work_id || !chapter_id || !duration_seconds) {
            return res.status(400).json({ 
                error: 'Required fields: work_id, chapter_id, duration_seconds' 
            });
        }

        if (scroll_depth_percent && (scroll_depth_percent < 0 || scroll_depth_percent > 100)) {
            return res.status(400).json({ 
                error: 'scroll_depth_percent must be 0-100' 
            });
        }

        // Crear sesión de lectura
        const sql = `
            INSERT INTO reading_sessions 
            (user_id, work_id, chapter_id, session_start, session_end, 
             duration_seconds, scroll_depth_percent, total_interactions, is_completed, exit_reason)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '1 second' * $4, 
                    CURRENT_TIMESTAMP, $4, $5, $6, $7, $8)
            RETURNING id, created_at
        `;

        const result = await query(sql, [
            user_id,
            work_id,
            chapter_id,
            duration_seconds,
            scroll_depth_percent || null,
            interactions_count || 0,
            is_completed || false,
            exit_reason || 'user_left'
        ]);

        // Actualizar agregaciones en background
        updateProgressAggregations(user_id, work_id, chapter_id, {
            duration_seconds,
            scroll_depth_percent,
            is_completed
        });

        res.json({
            success: true,
            session_id: result.rows[0].id,
            timestamp: result.rows[0].created_at
        });

    } catch (error) {
        logger.error('Error in updateReadingSession:', error);
        res.status(500).json({ error: 'Session update failed' });
    }
};


// ============================================
// 3. REGISTRAR PROGRESO DE CAPÍTULO
// ============================================
exports.updateChapterProgress = async (req, res) => {
    try {
        const user_id = req.user.id;
        const {
            work_id,
            chapter_id,
            chapter_number,
            is_completed,
            time_spent_minutes
        } = req.body;

        if (!work_id || !chapter_id || chapter_number === undefined) {
            return res.status(400).json({
                error: 'Required: work_id, chapter_id, chapter_number'
            });
        }

        // Upsert en chapter_progress
        const sql = `
            INSERT INTO chapter_progress 
            (user_id, work_id, chapter_id, last_read_chapter_number, 
             chapters_read_count, is_current_reading, last_read_at, completed_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, 
                    CASE WHEN $6 THEN CURRENT_TIMESTAMP ELSE NULL END)
            ON CONFLICT (user_id, work_id) DO UPDATE SET
                last_read_chapter_number = $4,
                last_read_at = CURRENT_TIMESTAMP,
                chapters_read_count = GREATEST(chapter_progress.chapters_read_count, $5),
                is_current_reading = $6,
                completed_at = CASE WHEN $6 THEN CURRENT_TIMESTAMP ELSE chapter_progress.completed_at END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING id, status
        `;

        const result = await query(sql, [
            user_id,
            work_id,
            chapter_id,
            chapter_number,
            chapter_number,  // chapters_read_count = chapter_number
            is_completed || false
        ]);

        res.json({
            success: true,
            progress_id: result.rows[0].id,
            status: result.rows[0].status
        });

        // Actualizar estadísticas en background
        updateCompletionStats(user_id, work_id, chapter_number, is_completed, time_spent_minutes);

    } catch (error) {
        logger.error('Error in updateChapterProgress:', error);
        res.status(500).json({ error: 'Progress update failed' });
    }
};


// ============================================
// FUNCIONES INTERNAS DE AGREGACIÓN
// ============================================

/**
 * Procesa agregación de eventos (no bloqueante)
 * - Actualiza preferencias de género/tropo
 * - Acumula tiempo de lectura
 * - Detecta cambios de estado
 */
async function processEventAggregation(userId, workId, chapterId, eventType, metadata) {
    try {
        // Obtener info de la obra para extraer géneros y tropos
        const workInfo = await query(
            `SELECT genre_id FROM series WHERE id = $1`,
            [workId]
        );

        if (workInfo.rows.length === 0) return;

        const genreId = workInfo.rows[0].genre_id;
        const timeSpent = metadata.duration_seconds ? Math.floor(metadata.duration_seconds / 60) : 0;

        // Actualizar preferencia de género si hay tiempo invertido
        if (timeSpent > 0 && genreId) {
            updateGenrePreference(userId, genreId, timeSpent);
        }

        // Detectar tropos si están en metadata
        if (metadata.tropes && Array.isArray(metadata.tropes)) {
            metadata.tropes.forEach(trope => {
                updateTropePreference(userId, trope, timeSpent);
            });
        }

    } catch (error) {
        logger.error('Error in processEventAggregation:', error);
    }
}


/**
 * Actualiza preferencias de género de forma asincrónica
 */
async function updateGenrePreference(userId, genreId, timeSpentMinutes) {
    try {
        const sql = `
            INSERT INTO user_genre_preferences 
            (user_id, genre_id, total_time_minutes, view_count, last_interaction)
            VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, genre_id) DO UPDATE SET
                total_time_minutes = user_genre_preferences.total_time_minutes + $3,
                view_count = user_genre_preferences.view_count + 1,
                last_interaction = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `;

        // Recalcular weighted_score basado en tiempo total
        await query(sql, [userId, genreId, timeSpentMinutes]);

        // Recalcular scores ponderados (normalización Max-Min)
        await recalculateGenreWeights(userId);

    } catch (error) {
        logger.error('Error updating genre preference:', error);
    }
}


/**
 * Actualiza preferencias de tropos
 */
async function updateTropePreference(userId, tropeName, timeSpentMinutes) {
    try {
        const sql = `
            INSERT INTO user_trope_preferences 
            (user_id, trope_name, appearance_count, total_time_minutes, last_interaction)
            VALUES ($1, $2, 1, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, trope_name) DO UPDATE SET
                appearance_count = user_trope_preferences.appearance_count + 1,
                total_time_minutes = user_trope_preferences.total_time_minutes + $3,
                last_interaction = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(sql, [userId, tropeName, timeSpentMinutes]);

        // Recalcular scores
        await recalculateTropeWeights(userId);

    } catch (error) {
        logger.error('Error updating trope preference:', error);
    }
}


/**
 * Actualiza estadísticas de finalización
 */
async function updateCompletionStats(userId, workId, chapterNumber, isCompleted, timeSpentMinutes = 0) {
    try {
        // Obtener total de capítulos disponibles
        const workQuery = await query(
            `SELECT COUNT(*) as total_chapters FROM chapters WHERE series_id = $1`,
            [workId]
        );

        const totalChapters = parseInt(workQuery.rows[0].total_chapters) || 0;
        const completionPercentage = totalChapters > 0 
            ? Math.round((chapterNumber / totalChapters) * 10000) / 100 
            : 0;
        const completionRatio = totalChapters > 0 ? chapterNumber / totalChapters : 0;

        const sql = `
            INSERT INTO work_completion_stats 
            (user_id, work_id, total_chapters_available, chapters_read, completion_percentage, 
             completion_ratio, total_time_minutes, is_completed, is_current, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)
            ON CONFLICT (user_id, work_id) DO UPDATE SET
                total_chapters_available = $3,
                chapters_read = GREATEST(work_completion_stats.chapters_read, $4),
                completion_percentage = $5,
                completion_ratio = $6,
                total_time_minutes = work_completion_stats.total_time_minutes + $7,
                is_completed = $8,
                completed_at = CASE WHEN $8 THEN CURRENT_TIMESTAMP ELSE work_completion_stats.completed_at END,
                status = CASE WHEN $8 THEN 'completed' ELSE 'reading' END,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(sql, [
            userId,
            workId,
            totalChapters,
            chapterNumber,
            completionPercentage,
            parseFloat(completionRatio.toFixed(2)),
            timeSpentMinutes || 0,
            isCompleted || false,
            isCompleted ? 'completed' : 'reading'
        ]);

    } catch (error) {
        logger.error('Error updating completion stats:', error);
    }
}


/**
 * Actualiza información de progreso general (sin esperar)
 */
async function updateProgressAggregations(userId, workId, chapterId, sessionData) {
    // Llamar async sin await
    setImmediate(async () => {
        try {
            const timeMinutes = Math.floor((sessionData.duration_seconds || 0) / 60);
            const chapter = await query(
                `SELECT chapter_number FROM chapters WHERE id = $1`,
                [chapterId]
            );

            if (chapter.rows.length > 0) {
                const chapterNumber = chapter.rows[0].chapter_number;
                await updateCompletionStats(userId, workId, chapterNumber, 
                    sessionData.is_completed, timeMinutes);
            }
        } catch (error) {
            logger.error('Error in background aggregation:', error);
        }
    });
}


/**
 * Recalcula weighted scores de géneros (normalización)
 */
async function recalculateGenreWeights(userId) {
    try {
        const userGenres = await query(
            `SELECT genre_id, total_time_minutes FROM user_genre_preferences 
             WHERE user_id = $1`,
            [userId]
        );

        if (userGenres.rows.length === 0) return;

        const maxTime = Math.max(...userGenres.rows.map(g => g.total_time_minutes), 1);

        // Actualizar scores normalizados
        for (const genre of userGenres.rows) {
            const normalizedScore = (genre.total_time_minutes / maxTime).toFixed(4);
            await query(
                `UPDATE user_genre_preferences 
                 SET weighted_score = $1 
                 WHERE user_id = $2 AND genre_id = $3`,
                [normalizedScore, userId, genre.genre_id]
            );
        }
    } catch (error) {
        logger.error('Error recalculating genre weights:', error);
    }
}


/**
 * Recalcula weighted scores de tropos (normalización)
 */
async function recalculateTropeWeights(userId) {
    try {
        const userTropes = await query(
            `SELECT trope_name, total_time_minutes, appearance_count 
             FROM user_trope_preferences 
             WHERE user_id = $1`,
            [userId]
        );

        if (userTropes.rows.length === 0) return;

        const maxTime = Math.max(...userTropes.rows.map(t => t.total_time_minutes), 1);
        const maxAppearance = Math.max(...userTropes.rows.map(t => t.appearance_count), 1);

        // Score mixto: 70% tiempo, 30% apariciones
        for (const trope of userTropes.rows) {
            const timeScore = trope.total_time_minutes / maxTime;
            const appearanceScore = trope.appearance_count / maxAppearance;
            const afinidadScore = (0.7 * timeScore + 0.3 * appearanceScore).toFixed(4);

            await query(
                `UPDATE user_trope_preferences 
                 SET afinidad_score = $1 
                 WHERE user_id = $2 AND trope_name = $3`,
                [afinidadScore, userId, trope.trope_name]
            );
        }
    } catch (error) {
        logger.error('Error recalculating trope weights:', error);
    }
}


// ============================================
// 4. DETECTAR ABANDONO (función scheduled)
// ============================================
exports.detectAbandonedWorks = async (req, res) => {
    try {
        const user_id = req.user.id;

        const sql = `
            UPDATE chapter_progress
            SET 
                status = 'abandoned',
                days_without_activity = EXTRACT(DAY FROM (CURRENT_TIMESTAMP - last_read_at))::INTEGER,
                abandoned_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE 
                user_id = $1 
                AND status = 'reading'
                AND (CURRENT_TIMESTAMP - last_read_at) > INTERVAL '${ABANDONMENT_THRESHOLD_DAYS} days'
                AND is_completed = FALSE
            RETURNING work_id, last_read_chapter_number, days_without_activity
        `;

        const result = await query(sql, [user_id]);

        if (result.rows.length > 0) {
            // Créar registros en work_abandonment para cada obra
            for (const row of result.rows) {
                await createAbandonmentRecord(user_id, row.work_id, 
                    row.last_read_chapter_number, row.days_without_activity);
            }
        }

        res.json({
            success: true,
            abandoned_count: result.rows.length,
            works: result.rows
        });

    } catch (error) {
        logger.error('Error detecting abandonments:', error);
        res.status(500).json({ error: 'Abandonment detection failed' });
    }
};


/**
 * Crea registro de abandono en tabla dedicada
 */
async function createAbandonmentRecord(userId, workId, lastChapterNumber, daysWithoutActivity) {
    try {
        const completionInfo = await query(
            `SELECT chapters_read, started_at, last_read_at 
             FROM chapter_progress 
             WHERE user_id = $1 AND work_id = $2`,
            [userId, workId]
        );

        if (completionInfo.rows.length === 0) return;

        const { started_at, last_read_at } = completionInfo.rows[0];

        const workStats = await query(
            `SELECT COUNT(*) as total_chapters FROM chapters WHERE series_id = $1`,
            [workId]
        );

        const totalChapters = parseInt(workStats.rows[0].total_chapters) || 1;
        const abandonmentPercent = (lastChapterNumber / totalChapters * 100).toFixed(2);

        const sql = `
            INSERT INTO work_abandonment 
            (user_id, work_id, last_chapter_number, total_chapters_available, 
             abandonment_percentage, started_at, last_access, days_without_activity)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id, work_id) DO UPDATE SET
                days_without_activity = $8,
                last_access = $7,
                updated_at = CURRENT_TIMESTAMP
        `;

        await query(sql, [
            userId, workId, lastChapterNumber, totalChapters, 
            abandonmentPercent, started_at, last_read_at, daysWithoutActivity
        ]);

    } catch (error) {
        logger.error('Error creating abandonment record:', error);
    }
}


// ============================================
// 5. DETECTAR RELECTURAS
// ============================================
exports.detectRereads = async (req, res) => {
    try {
        const user_id = req.user.id;

        // Obras que vuelve a leer (completadas, vuelve a acceder)
        const sql = `
            SELECT cp.work_id, cp.completed_at, 
                   EXTRACT(DAY FROM (CURRENT_TIMESTAMP - cp.completed_at))::INTEGER as days_since
            FROM chapter_progress cp
            WHERE cp.user_id = $1 
              AND cp.status = 'completed'
              AND cp.completed_at IS NOT NULL
            ORDER BY cp.last_read_at DESC
        `;

        const completed = await query(sql, [user_id]);

        let rereedCount = 0;

        for (const work of completed.rows) {
            // Verificar si tuvo actividad reciente después de completar
            const recentActivity = await query(
                `SELECT * FROM reading_sessions 
                 WHERE user_id = $1 AND work_id = $2 
                 AND created_at > $3
                 LIMIT 1`,
                [user_id, work.work_id, work.completed_at]
            );

            if (recentActivity.rows.length > 0) {
                // Es una relectura
                const insertSql = `
                    INSERT INTO work_rereads 
                    (user_id, work_id, first_completion_date, last_reread_date, reread_count)
                    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 1)
                    ON CONFLICT (user_id, work_id) DO UPDATE SET
                        reread_count = work_rereads.reread_count + 1,
                        last_reread_date = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                `;

                await query(insertSql, [user_id, work.work_id, work.completed_at]);
                rereedCount++;
            }
        }

        res.json({
            success: true,
            rereads_detected: rereedCount
        });

    } catch (error) {
        logger.error('Error detecting rereads:', error);
        res.status(500).json({ error: 'Reread detection failed' });
    }
};


// ============================================
// 6. EXPORTAR MÉTRICAS AGREGADAS
// ============================================
exports.getUserMetrics = async (req, res) => {
    try {
        const user_id = req.user.id;

        // Ejecutar todas las queries en paralelo
        const [topGenres, topTropes, completionStats, abandonedWorks, rereadWorks] = await Promise.all([
            // Top 3 géneros
            query(
                `SELECT genre_id, weighted_score, total_time_minutes, view_count
                 FROM user_top_genres 
                 WHERE user_id = $1 AND rank <= 3
                 ORDER BY rank`,
                [user_id]
            ),
            // Top 5 tropos
            query(
                `SELECT trope_name, afinidad_score, appearance_count, total_time_minutes
                 FROM user_top_tropes 
                 WHERE user_id = $1 AND rank <= 5
                 ORDER BY rank`,
                [user_id]
            ),
            // Estadísticas generales
            query(
                `SELECT completed_works, abandoned_works, reading_works, 
                        avg_completion_completed, avg_completion_abandoned
                 FROM user_work_status_summary
                 WHERE user_id = $1`,
                [user_id]
            ),
            // Obras abandonadas
            query(
                `SELECT work_id, last_chapter_number, abandonment_percentage, 
                        last_access, days_without_activity
                 FROM work_abandonment
                 WHERE user_id = $1
                 ORDER BY last_access DESC
                 LIMIT 10`,
                [user_id]
            ),
            // Obras re-leídas
            query(
                `SELECT work_id, reread_count, last_reread_date, days_since_first_completion
                 FROM work_rereads
                 WHERE user_id = $1
                 ORDER BY reread_count DESC
                 LIMIT 10`,
                [user_id]
            )
        ]);

        res.json({
            user_id,
            metrics: {
                top_genres: topGenres.rows,
                top_tropes: topTropes.rows,
                completion_stats: completionStats.rows[0] || {},
                abandoned_works: abandonedWorks.rows,
                reread_works: rereadWorks.rows
            },
            generated_at: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Error getting user metrics:', error);
        res.status(500).json({ error: 'Metrics retrieval failed' });
    }
};
