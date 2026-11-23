export const PROFILE_BACKGROUNDS = [
  { key: 'amanecer', accent: '#DF6C89', accentText: '#5C2335', label: { es: 'Amanecer', en: 'Sunrise' }, access: 'all', light: { from: '#FFE5D4', to: '#FFC4D6', text: '#1A1A2E' }, dark: { from: '#5A3A3F', to: '#6B3A50', text: '#FFFFFF' } },
  { key: 'sakura', accent: '#D96BA0', accentText: '#57233F', label: { es: 'Sakura', en: 'Sakura' }, access: 'all', light: { from: '#FFD6E8', to: '#E4D4FF', text: '#1A1A2E' }, dark: { from: '#5C3A55', to: '#3F3566', text: '#FFFFFF' } },
  { key: 'cielo', accent: '#3798CD', accentText: '#0F3852', label: { es: 'Cielo', en: 'Sky' }, access: 'all', light: { from: '#D6F1FF', to: '#F4FBFF', text: '#1A1A2E' }, dark: { from: '#1F3A4D', to: '#16283A', text: '#FFFFFF' } },
  { key: 'menta', accent: '#29A379', accentText: '#0D3E2E', label: { es: 'Menta', en: 'Mint' }, access: 'all', light: { from: '#D4F5E9', to: '#A8E6CF', text: '#1A1A2E' }, dark: { from: '#1F4D40', to: '#1A3A33', text: '#FFFFFF' } },
  { key: 'oro-imperial', accent: '#B88A17', accentText: '#483408', label: { es: 'Oro imperial', en: 'Imperial Gold' }, access: 'all', light: { from: '#FFF1C1', to: '#E8B94A', text: '#1A1A2E' }, dark: { from: '#5E4A14', to: '#3F3010', text: '#FFFFFF' } },
  { key: 'lavanda', accent: '#8E74E8', accentText: '#322562', label: { es: 'Lavanda', en: 'Lavender' }, access: 'all', light: { from: '#E6DEFF', to: '#B9A7F5', text: '#1A1A2E' }, dark: { from: '#3F3566', to: '#2C2550', text: '#FFFFFF' } },
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
];

export function getProfilePreset(key) {
  return PROFILE_BACKGROUNDS.find((preset) => preset.key === key) || null;
}
