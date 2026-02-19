/**
 * ============================================================================
 * MANHWA IMPERIAL - CONSTANTES DE COLORES PREMIUM AZUL
 * ============================================================================
 * 
 * Colores premium azul para usar en estilos inline de componentes React.
 * Estos valores deben coincidir con los definidos en imperial-variables.css
 * 
 * USO:
 * import { colors, getColor, alphaColor } from '../utils/imperialColors';
 * 
 * style={{ backgroundColor: colors.imperialBlueAlpha(0.2) }}
 * style={{ borderColor: colors.borderSubtle }}
 * 
 * ============================================================================
 */

// Colores base RGB
export const colorRGB = {
  imperialBlue: [0, 102, 204],      // #0066CC - Azul Imperial
  imperialCyan: [0, 168, 232],      // #00A8E8 - Cyan Premium
  emerald: [16, 185, 129],          // #10B981 - Esmeralda (sin cambios)
  ruby: [220, 38, 38],              // #DC2626 - Rubí (sin cambios)
  
  // Dark mode backgrounds - Azul marino profundo
  darkBg: [10, 25, 41],             // #0A1929
  darkCard: [15, 36, 61],           // #0F243D
  
  // Light mode backgrounds
  lightBg: [250, 249, 246],         // #FAF9F6
  lightCard: [255, 255, 255],       // #FFFFFF
};

// Función helper para crear colores con alpha
export const rgba = (rgb, alpha) => `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

// Colores con diferentes opacidades pre-calculados
export const colors = {
  // ─────────────────────────────────────────────────────────────────────────
  // Primario: Azul Imperial
  // ─────────────────────────────────────────────────────────────────────────
  imperialBlue: '#0066CC',
  imperialBlueLight: '#3399FF',
  imperialBlueDark: '#003D7A',
  
  // Con alpha
  imperialBlueAlpha: (alpha = 0.2) => rgba(colorRGB.imperialBlue, alpha),
  
  // ─────────────────────────────────────────────────────────────────────────
  // Secundario: Cyan Premium
  // ─────────────────────────────────────────────────────────────────────────
  imperialCyan: '#00A8E8',
  imperialCyanLight: '#33B8FF',
  imperialCyanDark: '#0077B6',
  
  // Con alpha
  imperialCyanAlpha: (alpha = 0.2) => rgba(colorRGB.imperialCyan, alpha),
  
  // ─────────────────────────────────────────────────────────────────────────
  // Acento: Esmeralda
  // ─────────────────────────────────────────────────────────────────────────
  emerald: '#10B981',
  emeraldLight: '#34D399',
  emeraldDark: '#059669',
  
  emeraldAlpha: (alpha = 0.2) => rgba(colorRGB.emerald, alpha),
  
  // ─────────────────────────────────────────────────────────────────────────
  // Error: Rubí
  // ─────────────────────────────────────────────────────────────────────────
  ruby: '#DC2626',
  rubyLight: '#F87171',
  
  rubyAlpha: (alpha = 0.2) => rgba(colorRGB.ruby, alpha),
  
  // ─────────────────────────────────────────────────────────────────────────
  // Gradientes (para backgroundImage)
  // ─────────────────────────────────────────────────────────────────────────
  gradientImperial: 'linear-gradient(135deg, #0066CC 0%, #00A8E8 100%)',
  gradientImperialSoft: (alpha = 0.1) => 
    `linear-gradient(135deg, ${rgba(colorRGB.imperialBlue, alpha)} 0%, ${rgba(colorRGB.imperialCyan, alpha)} 100%)`,
  
  gradientImperialHorizontal: (alpha = 0.1) =>
    `linear-gradient(to right, ${rgba(colorRGB.imperialBlue, alpha)}, ${rgba(colorRGB.imperialCyan, alpha)})`,
  
  // ─────────────────────────────────────────────────────────────────────────
  // Bordes
  // ─────────────────────────────────────────────────────────────────────────
  borderSubtle: 'var(--border-subtle)',
  borderImperial: (alpha = 0.2) => rgba(colorRGB.imperialBlue, alpha),
  borderCyan: (alpha = 0.2) => rgba(colorRGB.imperialCyan, alpha),
  
  // ─────────────────────────────────────────────────────────────────────────
  // Sombras
  // ─────────────────────────────────────────────────────────────────────────
  shadowImperial: `0 4px 20px ${rgba(colorRGB.imperialBlue, 0.15)}, 0 2px 8px ${rgba(colorRGB.imperialBlue, 0.1)}`,
  shadowImperialHover: `0 8px 32px ${rgba(colorRGB.imperialBlue, 0.25)}, 0 4px 12px ${rgba(colorRGB.imperialBlue, 0.15)}`,
  shadowCyan: `0 4px 20px ${rgba(colorRGB.imperialCyan, 0.15)}, 0 2px 8px ${rgba(colorRGB.imperialCyan, 0.1)}`,
  
  // ─────────────────────────────────────────────────────────────────────────
  // Fondos para cards y elementos
  // ─────────────────────────────────────────────────────────────────────────
  cardBgImperial: (alpha = 0.05) => rgba(colorRGB.imperialBlue, alpha),
  cardBgCyan: (alpha = 0.05) => rgba(colorRGB.imperialCyan, alpha),
  
  // ─────────────────────────────────────────────────────────────────────────
  // Estados de badge
  // ─────────────────────────────────────────────────────────────────────────
  badgeNew: {
    bg: rgba(colorRGB.imperialBlue, 0.15),
    text: '#3399FF',
    border: rgba(colorRGB.imperialBlue, 0.3),
  },
  badgeVip: {
    bg: rgba(colorRGB.imperialCyan, 0.15),
    text: '#33B8FF',
    border: rgba(colorRGB.imperialCyan, 0.3),
  },
  badgeHot: {
    bg: rgba(colorRGB.ruby, 0.15),
    text: '#F87171',
    border: rgba(colorRGB.ruby, 0.3),
  },
};

// Estilos comunes para reutilizar
export const imperialStyles = {
  // Card con borde imperial
  cardImperial: {
    backgroundColor: colors.cardBgImperial(0.05),
    border: `1px solid ${colors.borderImperial(0.2)}`,
    borderRadius: '0.75rem',
  },
  
  // Card destacada con gradiente
  cardFeatured: {
    backgroundImage: colors.gradientImperialHorizontal(0.1),
    border: `1px solid ${colors.borderImperial(0.2)}`,
    borderRadius: '0.75rem',
  },
  
  // Botón primario
  buttonPrimary: {
    background: colors.gradientImperial,
    color: '#FFFFFF',
    border: 'none',
    boxShadow: colors.shadowImperial,
  },
  
  // Badge imperial
  badgeImperial: {
    backgroundColor: colors.badgeNew.bg,
    color: colors.badgeNew.text,
    border: `1px solid ${colors.badgeNew.border}`,
  },
};

export default colors;
