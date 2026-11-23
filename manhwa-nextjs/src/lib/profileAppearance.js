export const PROFILE_BACKGROUNDS = [
  { key: 'amanecer', accent: '#C35E78', accentText: '#451A27', label: { es: 'Amanecer', en: 'Sunrise' }, access: 'all', light: { from: '#FFE5D4', to: '#FFC4D6', text: '#1A1A2E' }, dark: { from: '#5A3A3F', to: '#6B3A50', text: '#FFFFFF' } },
  { key: 'sakura', accent: '#D96BA0', accentText: '#57233F', label: { es: 'Sakura', en: 'Sakura' }, access: 'all', light: { from: '#FFD6E8', to: '#E4D4FF', text: '#1A1A2E' }, dark: { from: '#5C3A55', to: '#3F3566', text: '#FFFFFF' } },
  { key: 'cielo', accent: '#3798CD', accentText: '#0F3852', label: { es: 'Cielo', en: 'Sky' }, access: 'all', light: { from: '#D6F1FF', to: '#F4FBFF', text: '#1A1A2E' }, dark: { from: '#1F3A4D', to: '#16283A', text: '#FFFFFF' } },
  { key: 'menta', accent: '#29A379', accentText: '#0D3E2E', label: { es: 'Menta', en: 'Mint' }, access: 'all', light: { from: '#D4F5E9', to: '#A8E6CF', text: '#1A1A2E' }, dark: { from: '#1F4D40', to: '#1A3A33', text: '#FFFFFF' } },
  { key: 'oro-imperial', accent: '#B88A17', accentText: '#483409', label: { es: 'Oro imperial', en: 'Imperial Gold' }, access: 'all', light: { from: '#FFF1C1', to: '#E8B94A', text: '#1A1A2E' }, dark: { from: '#5E4A14', to: '#3F3010', text: '#FFFFFF' } },
  { key: 'lavanda', accent: '#8E74E8', accentText: '#322562', label: { es: 'Lavandddda', en: 'Lavender' }, access: 'all', light: { from: '#E6DEFF', to: '#B9A7F5', text: '#1A1A2E' }, dark: { from: '#3F3566', to: '#2C2550', text: '#FFFFFF' } },
  { key: 'atardecer', accent: '#D9683F', accentText: '#4F2313', label: { es: 'Atardecer', en: 'Sunset' }, access: 'all', light: { from: '#FFB88C', to: '#B57BEE', text: '#1A1A2E' }, dark: { from: '#7A4A38', to: '#4A2F73', text: '#FFFFFF' } },
  { key: 'oceano', accent: '#3E8DB5', accentText: '#113142', label: { es: 'Océano', en: 'Ocean' }, access: 'all', light: { from: '#3E7C9A', to: '#1F4E6E', text: '#FFFFFF' }, dark: { from: '#3E7C9A', to: '#1F4E6E', text: '#FFFFFF' } },
  { key: 'bosque', accent: '#3F9467', accentText: '#153323', label: { es: 'Bosque', en: 'Forest' }, access: 'all', light: { from: '#3F7D58', to: '#234B35', text: '#FFFFFF' }, dark: { from: '#3F7D58', to: '#234B35', text: '#FFFFFF' } },
  { key: 'rubi', accent: '#D0456B', accentText: '#3D101D', label: { es: 'Rubí', en: 'Ruby' }, access: 'all', light: { from: '#C73A5E', to: '#8E1B3A', text: '#FFFFFF' }, dark: { from: '#C73A5E', to: '#8E1B3A', text: '#FFFFFF' } },
  { key: 'medianoche', accent: '#5B6EE0', accentText: '#181F48', label: { es: 'Medianoche', en: 'Midnight' }, access: 'all', light: { from: '#2B3A67', to: '#1A1A3E', text: '#FFFFFF' }, dark: { from: '#2B3A67', to: '#1A1A3E', text: '#FFFFFF' } },
  { key: 'neon-sistema', accent: '#5B7CFA', accentText: '#1C2964', label: { es: 'Neón sistema', en: 'System Neon' }, access: 'all', light: { from: '#3A0CA3', to: '#1A6FCB', text: '#FFFFFF' }, dark: { from: '#3A0CA3', to: '#1A6FCB', text: '#FFFFFF' } },
];

export const PROFILE_TEXTURES = [
  { key: null, label: { es: 'Sin textura', en: 'No texture' } },
  { key: 'puntos', label: { es: 'Puntos', en: 'Dots' } },
  { key: 'estrellas', label: { es: 'Estrellas', en: 'Stars' } },
  { key: 'petalos-sakura', label: { es: 'Pétalos de sakura', en: 'Sakura petals' } },
  { key: 'corazones', label: { es: 'Corazones', en: 'Hearts' } },
  { key: 'espadas', label: { es: 'Espadas', en: 'Swords' } },
];

export function getProfilePreset(key) {
  return PROFILE_BACKGROUNDS.find((preset) => preset.key === key) || null;
}

export function getReadableTextColor(gradientColors) {
  const parseHex = (value) => {
    if (typeof value !== 'string') return null;
    const hex = value.trim().replace(/^#/, '');
    if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return null;
    const normalized = hex.length === 3
      ? hex.split('').map((character) => character + character).join('')
      : hex;
    return [
      parseInt(normalized.slice(0, 2), 16),
      parseInt(normalized.slice(2, 4), 16),
      parseInt(normalized.slice(4, 6), 16),
    ];
  };

  const luminance = (rgb) => {
    const channels = rgb.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };

  const contrast = (foreground, background) =>
    (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);

  const validColors = (gradientColors || [])
    .map(parseHex)
    .filter(Boolean);

  if (validColors.length === 0) return 'dark';

  const white = luminance([255, 255, 255]);
  const almostBlack = luminance([17, 24, 39]);

  // The selected tone must be the winner at the least readable gradient stop.
  const minimumContrastForTone = (foreground) =>
    Math.min(...validColors.map((rgb) => contrast(foreground, luminance(rgb))));

  const whiteWorstCase = minimumContrastForTone(white);
  const darkWorstCase = minimumContrastForTone(almostBlack);

  if (whiteWorstCase >= 4.5 && darkWorstCase >= 4.5) {
    return whiteWorstCase >= darkWorstCase ? 'light' : 'dark';
  }
  if (whiteWorstCase >= 4.5) return 'light';
  if (darkWorstCase >= 4.5) return 'dark';
  return whiteWorstCase >= darkWorstCase ? 'light' : 'dark';
}
