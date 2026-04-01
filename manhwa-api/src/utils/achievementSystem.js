/**
 * Sistema de Logros (Achievements)
 * 
 * Configuración de todos los logros disponibles en la plataforma
 * Cada logro tiene múltiples niveles que se desbloquean al alcanzar ciertos hitos
 */

// ============================================
// CONFIGURACIÓN DE LOGROS
// ============================================

const ACHIEVEMENT_TYPES = {
    RACHA: 'racha',           // Ya implementado - días consecutivos leyendo
    DIAMANTE: 'diamante',     // Capítulos totales leídos
    VELOZ: 'veloz',           // Capítulos leídos en 1 hora
    CRITICO: 'critico',       // Comentarios publicados
    NOCTURNO: 'nocturno',     // Noches leyendo en madrugada (00:00-05:00)
    ESTRELLA: 'estrella'      // Capítulos calificados
};

/**
 * Configuración de logro DIAMANTE (Capítulos totales leídos)
 * Progresa infinitamente - sin límite máximo
 */
const DIAMANTE_CONFIG = {
    type: ACHIEVEMENT_TYPES.DIAMANTE,
    name: 'Diamante',
    description: 'Lee capítulos para alcanzar nuevos niveles de dedicación',
    icon: 'IconDiamond',
    color: 'cyan',
    levels: [
        { level: 1, threshold: 100, name: 'Diamante I', color: 'cyan' },
        { level: 2, threshold: 1000, name: 'Diamante II', color: 'blue' },
        { level: 3, threshold: 10000, name: 'Diamante III', color: 'indigo' },
        { level: 4, threshold: 50000, name: 'Diamante IV', color: 'purple' },
        { level: 5, threshold: 100000, name: 'Diamante V', color: 'violet' },
        { level: 6, threshold: 500000, name: 'Diamante VI', color: 'fuchsia' }
    ],
    maxLevel: 6
};

/**
 * Configuración de logro VELOZ (Capítulos en 1 hora)
 * Basado en el máximo de capítulos leídos en cualquier ventana de 1 hora
 */
const VELOZ_CONFIG = {
    type: ACHIEVEMENT_TYPES.VELOZ,
    name: 'Veloz',
    description: 'Lee múltiples capítulos en tiempo récord',
    icon: 'IconBolt',
    color: 'yellow',
    levels: [
        { level: 1, threshold: 100, name: 'Veloz I', color: 'yellow' },
        { level: 2, threshold: 200, name: 'Veloz II', color: 'amber' },
        { level: 3, threshold: 300, name: 'Veloz III', color: 'orange' },
        { level: 4, threshold: 400, name: 'Veloz IV', color: 'red' },
        { level: 5, threshold: 500, name: 'Veloz V', color: 'rose' },
        { level: 6, threshold: 600, name: 'Veloz VI', color: 'pink' }
    ],
    maxLevel: 6
};

/**
 * Configuración de logro CRÍTICO (Comentarios publicados)
 * Progresa infinitamente - sin límite máximo
 */
const CRITICO_CONFIG = {
    type: ACHIEVEMENT_TYPES.CRITICO,
    name: 'Crítico',
    description: 'Comparte tus opiniones con la comunidad',
    icon: 'IconMessageCircle',
    color: 'green',
    levels: [
        { level: 1, threshold: 10, name: 'Crítico I', color: 'green' },
        { level: 2, threshold: 50, name: 'Crítico II', color: 'emerald' },
        { level: 3, threshold: 100, name: 'Crítico III', color: 'teal' },
        { level: 4, threshold: 500, name: 'Crítico IV', color: 'cyan' },
        { level: 5, threshold: 1000, name: 'Crítico V', color: 'sky' },
        { level: 6, threshold: 5000, name: 'Crítico VI', color: 'blue' },
        // Niveles adicionales para usuarios muy activos
        { level: 7, threshold: 10000, name: 'Crítico VII', color: 'indigo' },
        { level: 8, threshold: 50000, name: 'Crítico VIII', color: 'violet' }
    ],
    maxLevel: null // Infinito
};

/**
 * Configuración de logro LECTOR NOCTURNO (Noches leyendo en madrugada)
 * Cuenta días únicos donde leyó entre 00:00 y 05:00 UTC
 */
const NOCTURNO_CONFIG = {
    type: ACHIEVEMENT_TYPES.NOCTURNO,
    name: 'Lector Nocturno',
    description: 'Lee en las horas más oscuras de la noche',
    icon: 'IconMoon',
    color: 'purple',
    levels: [
        { level: 1, threshold: 30, name: 'Nocturno I', color: 'purple' },
        { level: 2, threshold: 50, name: 'Nocturno II', color: 'violet' },
        { level: 3, threshold: 100, name: 'Nocturno III', color: 'fuchsia' },
        { level: 4, threshold: 200, name: 'Nocturno IV', color: 'pink' },
        { level: 5, threshold: 365, name: 'Nocturno V', color: 'rose' },
        { level: 6, threshold: 730, name: 'Nocturno VI', color: 'red' }
    ],
    maxLevel: 6
};

/**
 * Configuración de logro PRIMERA ESTRELLA (Capítulos calificados)
 * Progresa infinitamente - sin límite máximo
 */
const ESTRELLA_CONFIG = {
    type: ACHIEVEMENT_TYPES.ESTRELLA,
    name: 'Primera Estrella',
    description: 'Califica capítulos para ayudar a otros lectores',
    icon: 'IconStar',
    color: 'amber',
    levels: [
        { level: 1, threshold: 10, name: 'Estrella I', color: 'yellow' },
        { level: 2, threshold: 50, name: 'Estrella II', color: 'amber' },
        { level: 3, threshold: 120, name: 'Estrella III', color: 'orange' },
        { level: 4, threshold: 500, name: 'Estrella IV', color: 'red' },
        { level: 5, threshold: 1000, name: 'Estrella V', color: 'rose' },
        { level: 6, threshold: 5000, name: 'Estrella VI', color: 'pink' },
        // Niveles adicionales para usuarios muy activos
        { level: 7, threshold: 10000, name: 'Estrella VII', color: 'fuchsia' },
        { level: 8, threshold: 50000, name: 'Estrella VIII', color: 'purple' }
    ],
    maxLevel: null // Infinito
};

/**
 * Configuración de logro RACHA (Días consecutivos leyendo)
 * Se actualiza cada vez que el usuario completa un capítulo
 */
const RACHA_CONFIG = {
    type: ACHIEVEMENT_TYPES.RACHA,
    name: 'Llama Eterna',
    description: 'Mantén una racha de días consecutivos leyendo',
    icon: 'IconFlame',
    color: 'orange',
    levels: [
        { level: 1, threshold: 30,  name: 'Inquebrantable I',   color: 'orange' },
        { level: 2, threshold: 60,  name: 'Inquebrantable II',  color: 'red'    },
        { level: 3, threshold: 90,  name: 'Inquebrantable III', color: 'violet' },
        { level: 4, threshold: 180, name: 'Llama Eterna',       color: 'cyan'   },
        { level: 5, threshold: 365, name: 'Llama Inmortal',     color: 'yellow' }
    ],
    maxLevel: 5
};

// Mapa de configuraciones por tipo
const ACHIEVEMENT_CONFIGS = {
    [ACHIEVEMENT_TYPES.RACHA]: RACHA_CONFIG,
    [ACHIEVEMENT_TYPES.DIAMANTE]: DIAMANTE_CONFIG,
    [ACHIEVEMENT_TYPES.VELOZ]: VELOZ_CONFIG,
    [ACHIEVEMENT_TYPES.CRITICO]: CRITICO_CONFIG,
    [ACHIEVEMENT_TYPES.NOCTURNO]: NOCTURNO_CONFIG,
    [ACHIEVEMENT_TYPES.ESTRELLA]: ESTRELLA_CONFIG
};

/**
 * Obtener configuración de un logro
 * @param {string} achievementType - Tipo de logro
 * @returns {object|null} Configuración del logro
 */
const getAchievementConfig = (achievementType) => {
    return ACHIEVEMENT_CONFIGS[achievementType] || null;
};

/**
 * Calcular nivel de logro basado en valor actual
 * @param {string} achievementType - Tipo de logro
 * @param {number} currentValue - Valor actual del usuario
 * @returns {object} { level, name, color, progress, nextThreshold }
 */
const calculateAchievementLevel = (achievementType, currentValue) => {
    const config = getAchievementConfig(achievementType);
    if (!config) {
        return { level: 0, name: null, color: null, progress: 0, nextThreshold: null };
    }

    const value = parseInt(currentValue) || 0;
    let currentLevel = 0;
    let levelConfig = null;
    let nextLevelConfig = null;

    // Encontrar el nivel actual dentro de los niveles definidos
    for (let i = 0; i < config.levels.length; i++) {
        if (value >= config.levels[i].threshold) {
            currentLevel = config.levels[i].level;
            levelConfig = config.levels[i];
            nextLevelConfig = config.levels[i + 1] || null;
        } else {
            break;
        }
    }

    // Niveles infinitos: si superó todos los definidos, calcular niveles extra
    // (dobla el último umbral por cada nivel adicional, idéntico al frontend)
    if (config.maxLevel === null && currentLevel >= config.levels.length) {
        let lastThreshold = config.levels[config.levels.length - 1].threshold;
        let extraLevel = currentLevel;
        let t = lastThreshold;
        let safety = 0;
        while (value >= t * 2 && safety < 50) {
            extraLevel++;
            t *= 2;
            safety++;
        }
        if (extraLevel > currentLevel) {
            currentLevel = extraLevel;
            const lastDefined = config.levels[config.levels.length - 1];
            levelConfig = {
                level: currentLevel,
                threshold: t,
                name: `${config.name} ${currentLevel}`,
                color: lastDefined.color
            };
        }
        // Siguiente umbral para nivel infinito
        nextLevelConfig = {
            level: currentLevel + 1,
            threshold: t * 2,
            name: `${config.name} ${currentLevel + 1}`,
            color: levelConfig.color
        };
    }

    // Si no alcanzó el nivel 1, mostrar progreso hacia nivel 1
    if (currentLevel === 0) {
        const firstLevel = config.levels[0];
        return {
            level: 0,
            name: 'Bloqueado',
            color: 'gray',
            progress: firstLevel.threshold > 0
                ? Math.min(100, (value / firstLevel.threshold) * 100)
                : 0,
            nextThreshold: firstLevel.threshold,
            nextLevelName: firstLevel.name,
            currentValue: value
        };
    }

    // Calcular progreso hacia el siguiente nivel
    let progress = 100;
    let nextThreshold = null;

    if (nextLevelConfig) {
        const currentThreshold = levelConfig.threshold;
        const range = nextLevelConfig.threshold - currentThreshold;
        const progressValue = value - currentThreshold;
        progress = range > 0
            ? Math.min(100, (progressValue / range) * 100)
            : 100;
        nextThreshold = nextLevelConfig.threshold;
    }

    return {
        level: currentLevel,
        name: levelConfig.name,
        color: levelConfig.color,
        progress: Math.round(progress * 100) / 100,
        nextThreshold,
        nextLevelName: nextLevelConfig?.name || null,
        currentValue: value,
        maxLevel: config.maxLevel,
        isMaxLevel: !nextLevelConfig && config.maxLevel !== null
    };
};

/**
 * Obtener todos los logros disponibles
 * @returns {array} Lista de configuraciones de logros
 */
const getAllAchievements = () => {
    return Object.values(ACHIEVEMENT_CONFIGS);
};

/**
 * Verificar si un usuario debería desbloquear un logro o subir de nivel
 * @param {string} achievementType - Tipo de logro
 * @param {number} currentValue - Valor actual del usuario
 * @param {number} previousValue - Valor anterior del usuario
 * @returns {object} { shouldUnlock, newLevel, previousLevel }
 */
const checkAchievementUnlock = (achievementType, currentValue, previousValue = 0) => {
    const current = calculateAchievementLevel(achievementType, currentValue);
    const previous = calculateAchievementLevel(achievementType, previousValue);

    return {
        shouldUnlock: current.level > previous.level,
        newLevel: current.level,
        previousLevel: previous.level,
        levelName: current.name,
        color: current.color
    };
};

module.exports = {
    ACHIEVEMENT_TYPES,
    ACHIEVEMENT_CONFIGS,
    RACHA_CONFIG,
    DIAMANTE_CONFIG,
    VELOZ_CONFIG,
    CRITICO_CONFIG,
    NOCTURNO_CONFIG,
    ESTRELLA_CONFIG,
    getAchievementConfig,
    calculateAchievementLevel,
    getAllAchievements,
    checkAchievementUnlock
};
