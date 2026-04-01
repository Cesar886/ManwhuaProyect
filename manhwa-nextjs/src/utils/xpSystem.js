/**
 * Sistema de XP y Niveles - Frontend
 * DIFICULTAD EXTREMA
 * 
 * Este módulo debe estar sincronizado con el backend (manhwa-api/src/utils/xpSystem.js)
 */

// ============================================
// CONFIGURACIÓN DE NIVELES (Idéntica al backend)
// ============================================

export const LEVEL_CONFIG = {
    1: {
        level: 1,
        name: 'Novato',
        minXp: 0,
        maxXp: 1000,
        color: 'gray',
        icon: 'IconBook',
        description: 'Recién comenzando tu viaje en Manhwa Imperial'
    },
    2: {
        level: 2,
        name: 'Guerrero',
        minXp: 1001,
        maxXp: 5000,
        color: 'cyan',
        icon: 'IconSword',
        description: 'Lector dedicado que conoce el camino'
    },
    3: {
        level: 3,
        name: 'Héroe',
        minXp: 5001,
        maxXp: 15000,
        color: 'violet',
        icon: 'IconShield',
        description: 'Maestro de la lectura, respetado en la comunidad'
    },
    4: {
        level: 4,
        name: 'Leyenda',
        minXp: 15001,
        maxXp: null,
        color: 'yellow',
        icon: 'IconCrown',
        description: 'Los más dedicados lectores de Manhwa Imperial'
    }
};

export const XP_CONFIG = {
    CHAPTER_COMPLETE: 5,
    DAILY_LIMIT: 200,
    MIN_READ_TIME_SECONDS: 90,
    LEGEND_THRESHOLD: 15001
};

/**
 * Calcular nivel basado en XP total
 * @param {number} experience - XP total del usuario
 * @returns {number} Nivel (1-4)
 */
export function calculateLevel(experience) {
    const xp = parseInt(experience) || 0;
    
    if (xp >= LEVEL_CONFIG[4].minXp) return 4; // Leyenda
    if (xp >= LEVEL_CONFIG[3].minXp) return 3; // Héroe
    if (xp >= LEVEL_CONFIG[2].minXp) return 2; // Guerrero
    return 1; // Novato
}

/**
 * Obtener información completa del nivel actual
 * @param {number} experience - XP total del usuario
 * @returns {object} Información del nivel
 */
export function getLevelInfo(experience) {
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
}

/**
 * Obtener todos los umbrales de niveles
 * @returns {array} Lista de configuraciones de niveles
 */
export function getLevelThresholds() {
    return Object.values(LEVEL_CONFIG);
}

/**
 * Formatear XP con separadores de miles
 * @param {number} xp
 * @returns {string}
 */
export function formatXp(xp) {
    return new Intl.NumberFormat('es-ES').format(xp || 0);
}

/**
 * Obtener color de Mantine basado en el color del nivel
 * @param {string} colorName - 'gray', 'cyan', 'violet', 'yellow'
 * @returns {string} Color de Mantine
 */
export function getLevelColor(colorName) {
    const colorMap = {
        'gray': 'gray',
        'cyan': 'cyan',
        'violet': 'violet',
        'yellow': 'yellow'
    };
    return colorMap[colorName] || 'gray';
}

/**
 * Obtener gradiente de nivel
 * @param {number} level
 * @returns {object} Configuración de gradiente para Mantine
 */
export function getLevelGradient(level) {
    const gradients = {
        1: { from: 'gray', to: 'dark', deg: 135 },
        2: { from: 'cyan', to: 'blue', deg: 135 },
        3: { from: 'violet', to: 'grape', deg: 135 },
        4: { from: 'yellow', to: 'orange', deg: 135 }
    };
    return gradients[level] || gradients[1];
}
