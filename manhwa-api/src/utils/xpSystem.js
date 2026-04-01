/**
 * Sistema de XP y Niveles - DIFICULTAD EXTREMA
 * 
 * Configuración diseñada para que alcanzar "Leyenda" sea un verdadero logro
 * que requiere meses de lectura dedicada.
 */

// ============================================
// CONFIGURACIÓN DE NIVELES (EXTREMADAMENTE DIFÍCIL)
// ============================================

const LEVEL_CONFIG = {
    1: {
        name: 'Novato',
        minXp: 0,
        maxXp: 100, // MODIFICADO: Antes 1000
        color: 'gray',
        icon: 'IconBook',
        description: 'Recién comenzando tu viaje en Manhwa Imperial'
    },
    2: {
        name: 'Guerrero',
        minXp: 101, // MODIFICADO: Antes 1001
        maxXp: 5000,
        color: 'cyan',
        icon: 'IconSword',
        description: 'Lector dedicado que conoce el camino'
    },
    3: {
        name: 'Héroe',
        minXp: 5001,
        maxXp: 15000,
        color: 'violet',
        icon: 'IconShield',
        description: 'Maestro de la lectura, respetado en la comunidad'
    },
    4: {
        name: 'Leyenda',
        minXp: 15001,
        maxXp: null, // Sin límite superior
        color: 'yellow',
        icon: 'IconCrown',
        description: 'Los más dedicados lectores de Manhwa Imperial'
    }
};

// ============================================
// CONFIGURACIÓN DE XP (DIFICULTAD EXTREMA)
// ============================================

const XP_CONFIG = {
    // XP otorgado por completar capítulo (reducido a la mitad)
    CHAPTER_COMPLETE: 5,
    
    // Límite de XP por día (muy restrictivo - máx 40 capítulos/día)
    DAILY_LIMIT: 200,
    
    // Tiempo mínimo en capítulo para otorgar XP (90 segundos)
    MIN_READ_TIME_SECONDS: 90,
    
    // Multiplicador futuro para rachas (no implementado aún)
    STREAK_MULTIPLIER: 1.0,
    
    // XP requerido para Leyenda
    LEGEND_THRESHOLD: 15001
};

/**
 * Calcular nivel basado en XP total
 * @param {number} experience - XP total del usuario
 * @returns {number} Nivel (1-4)
 */
const calculateLevel = (experience) => {
    const xp = parseInt(experience) || 0;
    
    if (xp >= LEVEL_CONFIG[4].minXp) return 4; // Leyenda
    if (xp >= LEVEL_CONFIG[3].minXp) return 3; // Héroe
    if (xp >= LEVEL_CONFIG[2].minXp) return 2; // Guerrero
    return 1; // Novato
};

/**
 * Obtener información completa del nivel actual
 * @param {number} experience - XP total del usuario
 * @returns {object} Información del nivel
 */
const getLevelInfo = (experience) => {
    const level = calculateLevel(experience);
    const config = LEVEL_CONFIG[level];
    const xp = parseInt(experience) || 0;
    
    // Calcular progreso al siguiente nivel
    let progress = 0;
    let nextLevelXp = null;
    let xpToNextLevel = null;
    
    if (level < 4) {
        const nextLevelConfig = LEVEL_CONFIG[level + 1];
        nextLevelXp = nextLevelConfig.minXp;
        const currentLevelMin = config.minXp;
        const xpRange = nextLevelXp - currentLevelMin;
        const xpInCurrentLevel = xp - currentLevelMin;
        progress = Math.min(100, Math.max(0, (xpInCurrentLevel / xpRange) * 100));
        xpToNextLevel = nextLevelXp - xp;
    } else {
        // Leyenda - siempre al 100%
        progress = 100;
    }
    
    return {
        level,
        name: config.name,
        color: config.color,
        icon: config.icon,
        description: config.description,
        currentXp: xp,
        minXp: config.minXp,
        maxXp: config.maxXp,
        nextLevelXp,
        xpToNextLevel: Math.max(0, xpToNextLevel || 0),
        progress: Math.round(progress * 100) / 100 // 2 decimales
    };
};

/**
 * Obtener todos los umbrales de niveles
 * @returns {array} Lista de configuraciones de niveles
 */
const getLevelThresholds = () => {
    return Object.values(LEVEL_CONFIG);
};

/**
 * Obtener límite de XP diario
 * @returns {number} Límite de XP por día
 */
const getDailyXpLimit = () => {
    return XP_CONFIG.DAILY_LIMIT;
};

/**
 * Obtener configuración de XP
 * @returns {object} Configuración completa de XP
 */
const getXpConfig = () => {
    return { ...XP_CONFIG };
};

/**
 * Validar si se puede otorgar XP
 * @param {object} params - Parámetros de validación
 * @param {number} params.dailyXpEarned - XP ya ganado hoy
 * @param {number} params.timeSpentSeconds - Tiempo en el capítulo (segundos)
 * @param {boolean} params.alreadyCompleted - Si ya completó este capítulo antes
 * @returns {object} { canGrant: boolean, reason: string, xpToGrant: number }
 */
const validateXpGrant = ({ dailyXpEarned = 0, timeSpentSeconds = 0, alreadyCompleted = false }) => {
    // 1. Validar que no haya completado este capítulo antes
    if (alreadyCompleted) {
        return {
            canGrant: false,
            reason: 'Ya completaste este capítulo anteriormente',
            xpToGrant: 0
        };
    }
    
    // 2. Validar tiempo mínimo de lectura (90 segundos)
    if (timeSpentSeconds < XP_CONFIG.MIN_READ_TIME_SECONDS) {
        return {
            canGrant: false,
            reason: `Debes leer al menos ${XP_CONFIG.MIN_READ_TIME_SECONDS} segundos para ganar XP (leíste ${timeSpentSeconds}s)`,
            xpToGrant: 0
        };
    }
    
    // 3. Validar límite diario
    if (dailyXpEarned >= XP_CONFIG.DAILY_LIMIT) {
        return {
            canGrant: false,
            reason: `Alcanzaste el límite diario de ${XP_CONFIG.DAILY_LIMIT} XP`,
            xpToGrant: 0
        };
    }
    
    // 4. Calcular XP a otorgar (puede ser menor si se acerca al límite diario)
    const xpToGrant = Math.min(
        XP_CONFIG.CHAPTER_COMPLETE,
        XP_CONFIG.DAILY_LIMIT - dailyXpEarned
    );
    
    return {
        canGrant: true,
        reason: 'XP otorgado exitosamente',
        xpToGrant
    };
};

/**
 * Calcular XP por tiempo de lectura (no usado actualmente, pero útil para futuro)
 * @param {number} timeSpentSeconds - Tiempo en segundos
 * @returns {number} XP calculado
 */
const calculateXpByTime = (timeSpentSeconds) => {
    // Podría implementarse en el futuro un sistema de XP proporcional al tiempo
    // Por ahora solo validamos el mínimo
    return timeSpentSeconds >= XP_CONFIG.MIN_READ_TIME_SECONDS ? XP_CONFIG.CHAPTER_COMPLETE : 0;
};

/**
 * Verificar si el usuario subió de nivel
 * @param {number} previousXp - XP anterior
 * @param {number} newXp - XP nuevo
 * @returns {object} { leveledUp: boolean, oldLevel: number, newLevel: number }
 */
const checkLevelUp = (previousXp, newXp) => {
    const oldLevel = calculateLevel(previousXp);
    const newLevel = calculateLevel(newXp);
    
    return {
        leveledUp: newLevel > oldLevel,
        oldLevel,
        newLevel,
        levelName: LEVEL_CONFIG[newLevel].name
    };
};

/**
 * Obtener estadísticas estimadas para alcanzar un nivel
 * @param {number} targetLevel - Nivel objetivo (1-4)
 * @returns {object} Estadísticas estimadas
 */
const getEstimatedTimeToLevel = (targetLevel) => {
    const config = LEVEL_CONFIG[targetLevel];
    if (!config) return null;
    
    const xpNeeded = config.minXp;
    const chaptersNeeded = Math.ceil(xpNeeded / XP_CONFIG.CHAPTER_COMPLETE);
    const daysIfMaxDaily = Math.ceil(xpNeeded / XP_CONFIG.DAILY_LIMIT);
    
    return {
        level: targetLevel,
        name: config.name,
        xpNeeded,
        chaptersNeeded,
        daysIfMaxDaily,
        weeksIfMaxDaily: Math.ceil(daysIfMaxDaily / 7),
        monthsIfMaxDaily: Math.ceil(daysIfMaxDaily / 30)
    };
};

module.exports = {
    LEVEL_CONFIG,
    XP_CONFIG,
    calculateLevel,
    getLevelInfo,
    getLevelThresholds,
    getDailyXpLimit,
    getXpConfig,
    validateXpGrant,
    calculateXpByTime,
    checkLevelUp,
    getEstimatedTimeToLevel
};
