/**
 * ============================================================================
 * MANHWA IMPERIAL - TEMA PREMIUM AZUL
 * ============================================================================
 * 
 * Paleta de colores Imperial en Azul Premium, inspirada en elegancia y sofisticación.
 * 
 * GUÍA DE USO DE COLORES:
 * 
 * 💙 PRIMARIO (Azul Imperial):
 *    - Botones principales, CTAs importantes
 *    - Iconos destacados, badges premium
 *    - Links activos, elementos de acción
 * 
 * 🌊 SECUNDARIO (Azul Cielo/Cyan):
 *    - Acentos secundarios, hover states
 *    - Badges especiales, elementos destacados
 *    - Gradientes con el azul imperial
 * 
 * 💎 ACENTO (Esmeralda/Teal):
 *    - Indicadores de estado (online, activo)
 *    - Badges de géneros, tags
 *    - Elementos informativos
 * 
 * 📖 FONDOS:
 *    - Dark: Azul marino profundo (#0A1929)
 *    - Light: Blanco/Crema, limpio y espacioso
 * 
 * ⚡ ESTADOS:
 *    - Success: Verde esmeralda suave
 *    - Warning: Azul claro (usa el secundario)
 *    - Error: Rojo rubí, no saturado
 *    - Info: Cyan claro
 */

// Paleta Imperial Azul completa para Mantine
export const imperialColors = {
  // Azul Imperial - Color primario
  imperial: [
    '#E6F2FF', // 0 - Lightest
    '#B3D9FF', // 1
    '#80BFFF', // 2
    '#4DA6FF', // 3
    '#3399FF', // 4
    '#0066CC', // 5 - Base (main)
    '#0052A3', // 6 - Azul profundo
    '#003D7A', // 7
    '#002952', // 8
    '#001429', // 9 - Darkest
  ],

  // Sobrescribir cyan de Mantine para usar azul imperial
  // Esto permite que los componentes que usan color="cyan" se vean imperiales
  cyan: [
    '#E0F7FF', // 0 - Lightest
    '#B3ECFF', // 1
    '#80E0FF', // 2
    '#4DD4FF', // 3
    '#33B8FF', // 4
    '#00A8E8', // 5 - Base (cyan imperial)
    '#0096C7', // 6
    '#0077B6', // 7
    '#023E8A', // 8
    '#012A5C', // 9 - Darkest
  ],

  // Azul Cielo - Color secundario (anteriormente púrpura)
  royalPurple: [
    '#E0F7FF', // 0
    '#B3ECFF', // 1
    '#80E0FF', // 2
    '#4DD4FF', // 3
    '#33B8FF', // 4
    '#00A8E8', // 5 - Base
    '#0096C7', // 6
    '#0077B6', // 7
    '#005580', // 8
    '#003D5C', // 9
  ],

  // Esmeralda - Color de acento (se mantiene)
  emerald: [
    '#ECFDF5', // 0
    '#D1FAE5', // 1
    '#A7F3D0', // 2
    '#6EE7B7', // 3
    '#34D399', // 4
    '#10B981', // 5 - Base
    '#059669', // 6
    '#047857', // 7
    '#065F46', // 8
    '#064E3B', // 9
  ],

  // Sobrescribir violet/indigo para usar azul cielo
  violet: [
    '#E0F7FF', // 0
    '#B3ECFF', // 1
    '#80E0FF', // 2
    '#4DD4FF', // 3
    '#33B8FF', // 4
    '#00A8E8', // 5 - Base
    '#0096C7', // 6
    '#0077B6', // 7
    '#005580', // 8
    '#003D5C', // 9
  ],

  indigo: [
    '#E6F2FF', // 0
    '#B3D9FF', // 1
    '#80BFFF', // 2
    '#4DA6FF', // 3
    '#3399FF', // 4
    '#0066CC', // 5 - Base
    '#0052A3', // 6
    '#003D7A', // 7
    '#002952', // 8
    '#001429', // 9
  ],

  // Fondos Dark Mode - Azul Marino Profundo
  darkBg: [
    '#0F243D', // 0 - Card bg
    '#0C1E33', // 1 - Elevated
    '#0A1929', // 2 - Main surface (base)
    '#081420', // 3 - Deeper
    '#060F18', // 4 - Deep
    '#040A10', // 5 - Deepest
    '#030708', // 6
    '#020505', // 7
    '#010303', // 8
    '#000000', // 9
  ],

  // Fondos Light Mode - Blanco Limpio
  lightBg: [
    '#FFFFFF', // 0 - Pure white
    '#FDFCFB', // 1 - Off-white
    '#FAF9F6', // 2 - Ivory (main bg)
    '#F7F5F0', // 3 - Cream
    '#F3F0E8', // 4 - Warm cream
    '#EDE9DD', // 5 - Beige light
    '#E5E0D0', // 6 - Beige
    '#D9D3C3', // 7
    '#C9C2B0', // 8
    '#B8B09D', // 9
  ],

  // Rubí - Para errores/alertas
  ruby: [
    '#FEF2F2', // 0
    '#FEE2E2', // 1
    '#FECACA', // 2
    '#FCA5A5', // 3
    '#F87171', // 4
    '#DC2626', // 5 - Base
    '#B91C1C', // 6
    '#991B1B', // 7
    '#7F1D1D', // 8
    '#450A0A', // 9
  ],
};

// Tema de Mantine configurado
export const imperialTheme = {
  // Color scheme (se maneja dinámicamente)
  // colorScheme: 'dark', // Comentado - se maneja en App.jsx

  // Colores personalizados
  colors: imperialColors,

  // Color primario
  primaryColor: 'imperial',
  primaryShade: { light: 6, dark: 4 },

  // Tipografía Premium
  fontFamily: '"Outfit", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontFamilyMonospace: '"JetBrains Mono", "Fira Code", Monaco, Consolas, monospace',

  // Headings con fuente elegante
  headings: {
    fontFamily: '"Playfair Display", "Outfit", Georgia, serif',
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '2.5rem', lineHeight: '1.2' },
      h2: { fontSize: '2rem', lineHeight: '1.25' },
      h3: { fontSize: '1.5rem', lineHeight: '1.3' },
      h4: { fontSize: '1.25rem', lineHeight: '1.35' },
      h5: { fontSize: '1rem', lineHeight: '1.4' },
      h6: { fontSize: '0.875rem', lineHeight: '1.45' },
    },
  },

  // Radios más suaves para look premium
  radius: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
  },

  // Espaciado
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },

  // Sombras premium con tinte de color
  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.05)',
    sm: '0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
    md: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)',
    lg: '0 8px 24px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.16), 0 8px 16px rgba(0, 0, 0, 0.08)',
    // Sombras con tinte dorado para elementos destacados
    imperial: '0 4px 20px rgba(212, 165, 40, 0.15), 0 2px 8px rgba(212, 165, 40, 0.1)',
    imperialHover: '0 8px 32px rgba(212, 165, 40, 0.25), 0 4px 12px rgba(212, 165, 40, 0.15)',
    // Sombras con tinte púrpura
    purple: '0 4px 20px rgba(139, 92, 200, 0.15), 0 2px 8px rgba(139, 92, 200, 0.1)',
  },

  // Otros valores por defecto
  defaultRadius: 'md',
  cursorType: 'pointer',
  focusRing: 'auto',

  // Componentes personalizados
  components: {
    // Botones premium
    Button: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
      },
    },

    // Cards con estilo premium
    Card: {
      defaultProps: {
        radius: 'lg',
        padding: 'lg',
      },
      styles: {
        root: {
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-subtle)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            borderColor: 'var(--border-hover)',
          },
        },
      },
    },

    // Inputs elegantes
    Input: {
      styles: {
        input: {
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
          transition: 'all 0.2s ease',
          '&:focus': {
            backgroundColor: 'var(--input-bg-focus)',
            borderColor: 'var(--imperial-primary)',
            boxShadow: '0 0 0 3px var(--imperial-primary-alpha)',
          },
          '&::placeholder': {
            color: 'var(--text-muted)',
          },
        },
      },
    },

    TextInput: {
      styles: {
        input: {
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
          '&:focus': {
            borderColor: 'var(--imperial-primary)',
            boxShadow: '0 0 0 3px var(--imperial-primary-alpha)',
          },
        },
      },
    },

    Select: {
      styles: {
        input: {
          backgroundColor: 'var(--input-bg)',
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-primary)',
        },
        dropdown: {
          backgroundColor: 'var(--dropdown-bg)',
          borderColor: 'var(--border-subtle)',
        },
      },
    },

    // Menús premium
    Menu: {
      styles: {
        dropdown: {
          backgroundColor: 'var(--dropdown-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--mantine-radius-lg)',
          backdropFilter: 'blur(12px)',
          boxShadow: 'var(--shadow-lg)',
        },
        item: {
          color: 'var(--text-primary)',
          borderRadius: 'var(--mantine-radius-md)',
          transition: 'all 0.15s ease',
          '&:hover': {
            backgroundColor: 'var(--hover-bg)',
          },
        },
        divider: {
          borderColor: 'var(--border-subtle)',
        },
      },
    },

    // Modales elegantes
    Modal: {
      styles: {
        content: {
          backgroundColor: 'var(--modal-bg)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-xl)',
        },
        header: {
          backgroundColor: 'transparent',
          borderBottom: '1px solid var(--border-subtle)',
        },
        title: {
          fontWeight: 600,
          color: 'var(--text-primary)',
        },
        close: {
          color: 'var(--text-muted)',
          '&:hover': {
            backgroundColor: 'var(--hover-bg)',
            color: 'var(--text-primary)',
          },
        },
      },
    },

    // Badges con estilo
    Badge: {
      styles: {
        root: {
          fontWeight: 600,
          textTransform: 'capitalize',
        },
      },
    },

    // Tabs elegantes
    Tabs: {
      styles: {
        tab: {
          fontWeight: 500,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: 'var(--hover-bg)',
          },
          '&[data-active="true"]': {
            borderColor: 'var(--imperial-primary)',
            color: 'var(--imperial-primary)',
          },
        },
      },
    },

    // Skeleton con shimmer elegante
    Skeleton: {
      styles: {
        root: {
          backgroundColor: 'var(--skeleton-bg)',
          '&::after': {
            background: 'linear-gradient(90deg, transparent, var(--skeleton-shimmer), transparent)',
          },
        },
      },
    },

    // Tooltips
    Tooltip: {
      styles: {
        tooltip: {
          backgroundColor: 'var(--tooltip-bg)',
          color: 'var(--tooltip-text)',
          fontSize: '0.8125rem',
          fontWeight: 500,
          boxShadow: 'var(--shadow-md)',
        },
      },
    },

    // ActionIcon con hover suave
    ActionIcon: {
      styles: {
        root: {
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
          },
        },
      },
    },

    // Avatar
    Avatar: {
      styles: {
        root: {
          border: '2px solid var(--border-subtle)',
        },
      },
    },

    // Divider
    Divider: {
      styles: {
        root: {
          borderColor: 'var(--border-subtle)',
        },
      },
    },

    // Paper
    Paper: {
      styles: {
        root: {
          backgroundColor: 'var(--card-bg)',
        },
      },
    },
  },
};

export default imperialTheme;
