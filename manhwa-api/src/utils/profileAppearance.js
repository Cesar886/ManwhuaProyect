// Keep these keys synchronized with manhwa-nextjs/src/lib/profileAppearance.js.
const ALLOWED_PROFILE_BACKGROUNDS = new Set([
  'amanecer', 'sakura', 'cielo', 'menta', 'oro-imperial', 'lavanda',
  'atardecer', 'oceano', 'bosque', 'rubi', 'medianoche', 'neon-sistema',
]);

const ALLOWED_PROFILE_TEXTURES = new Set([
  'puntos', 'estrellas', 'petalos-sakura', 'corazones', 'espadas',
]);

const ALLOWED_PROFILE_TEXT_COLORS = new Set(['white', 'black']);

function validateProfileAppearance(field, value, allowedKeys) {
  if (typeof value === 'undefined') return null;
  if (value === null) return null;
  if (typeof value !== 'string' || !allowedKeys.has(value)) {
    return {
      field,
      message: `Valor no permitido para ${field}. Debe ser null o una clave válida.`,
    };
  }
  return null;
}

module.exports = {
  ALLOWED_PROFILE_BACKGROUNDS,
  ALLOWED_PROFILE_TEXTURES,
  ALLOWED_PROFILE_TEXT_COLORS,
  validateProfileAppearance,
};
