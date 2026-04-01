'use client';

// Re-exporta desde el sistema unificado de logros (Achievements.jsx)
export { StreakFlame, VitrinaLogros } from '@/components/achievements/Achievements';

/**
 * LogrosSection — sección completa de insignias para la página de perfil.
 *
 * @param {Object}  stats    — estadísticas del usuario para calcular logros
 * @param {boolean} isDark   — tema oscuro/claro
 * @param {boolean} isMobile — viewport móvil
 */
export { VitrinaLogros as default } from '@/components/achievements/Achievements';
