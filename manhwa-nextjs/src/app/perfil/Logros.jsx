'use client';

import { VitrinaLogros } from '@/components/achievements/Logros';

// Re-exporta los building blocks para que cualquier parte de /perfil
// importe la llama y la vitrina desde aquí (fuente canónica del perfil).
export { StreakFlame, VitrinaLogros } from '@/components/achievements/Logros';

/**
 * LogrosSection — sección completa de insignias para la página de perfil.
 *
 * @param {number}  streak   — días de racha actuales
 * @param {boolean} isDark   — tema oscuro/claro
 * @param {boolean} isMobile — viewport móvil
 */
export default function LogrosSection({ streak = 0, isDark = false, isMobile = false }) {
  return <VitrinaLogros streak={streak} isDark={isDark} isMobile={isMobile} />;
}
