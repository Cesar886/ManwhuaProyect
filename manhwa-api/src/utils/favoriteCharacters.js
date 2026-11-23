const FAVORITE_CHARACTER_PALETTE = [
    '#F9A8D4',
    '#FBCFE8',
    '#FDA4AF',
    '#FDBA74',
    '#FDE68A',
    '#86EFAC',
    '#5EEAD4',
    '#67E8F9',
    '#93C5FD',
    '#C4B5FD',
    '#D8B4FE',
];

const LEGACY_FAVORITE_CHARACTER_COLORS = {
    '#E64980': '#F9A8D4',
    '#F06595': '#FBCFE8',
    '#FA5252': '#FDA4AF',
    '#FD7E14': '#FDBA74',
    '#FAB005': '#FDE68A',
    '#40C057': '#86EFAC',
    '#12B886': '#5EEAD4',
    '#15AABF': '#67E8F9',
    '#228BE6': '#93C5FD',
    '#7950F2': '#C4B5FD',
    '#AE3EC9': '#D8B4FE',
};

const normalizeFavoriteCharacterColor = (value) => {
    const color = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (FAVORITE_CHARACTER_PALETTE.includes(color)) return color;
    return LEGACY_FAVORITE_CHARACTER_COLORS[color] || null;
};

const normalizeFavoriteCharacterName = (value) => {
    if (typeof value !== 'string') return '';
    return value.normalize ? value.normalize('NFC').trim() : value.trim();
};

const validateFavoriteCharacters = (value) => {
    const errors = [];

    if (!Array.isArray(value)) {
        return [{ field: 'favoriteCharacters', message: 'Los personajes favoritos deben enviarse como un arreglo' }];
    }
    if (value.length > 3) {
        errors.push({ field: 'favoriteCharacters', message: 'Puedes guardar como máximo 3 personajes favoritos' });
    }

    const positions = new Set();
    value.slice(0, 3).forEach((character, index) => {
        if (!character || typeof character !== 'object' || Array.isArray(character)) {
            errors.push({ field: `favoriteCharacters.${index}`, message: 'El personaje debe ser un objeto válido' });
            return;
        }

        if (!['waifu', 'husband'].includes(character.type)) {
            errors.push({
                field: `favoriteCharacters.${index}.type`,
                message: 'El tipo debe ser "waifu" o "husband"',
            });
        }

        const name = normalizeFavoriteCharacterName(character.name);
        if (!name) {
            errors.push({
                field: `favoriteCharacters.${index}.name`,
                message: 'El nombre del personaje es obligatorio',
            });
        } else if ([...name].length > 25) {
            errors.push({
                field: `favoriteCharacters.${index}.name`,
                message: 'El nombre no puede exceder 25 caracteres',
            });
        }

        if (
            /[<>]/.test(name)
            || /script|javascript\s*:|on[a-z]+\s*=/i.test(name)
            || /[\u0000-\u001F\u007F]/.test(name)
        ) {
            errors.push({
                field: `favoriteCharacters.${index}.name`,
                message: 'El nombre no puede contener HTML, scripts o caracteres de control',
            });
        }

        const color = typeof character.color === 'string'
            ? character.color.trim().toUpperCase()
            : '';
        const normalizedColor = normalizeFavoriteCharacterColor(color);
        if (!normalizedColor) {
            errors.push({
                field: `favoriteCharacters.${index}.color`,
                message: 'El color seleccionado no pertenece a la paleta permitida',
            });
        }

        const position = Number.isInteger(character.position) ? character.position : index;
        if (position < 0 || position > 2) {
            errors.push({
                field: `favoriteCharacters.${index}.position`,
                message: 'La posición debe estar entre 0 y 2',
            });
        } else if (positions.has(position)) {
            errors.push({
                field: `favoriteCharacters.${index}.position`,
                message: 'La posición no puede repetirse',
            });
        } else {
            positions.add(position);
        }
    });

    if (errors.length > 0) return errors;

    return value.slice(0, 3).map((character, index) => ({
        type: character.type,
        name: normalizeFavoriteCharacterName(character.name),
        color: normalizeFavoriteCharacterColor(character.color),
        position: Number.isInteger(character.position) ? character.position : index,
    }));
};

module.exports = {
    FAVORITE_CHARACTER_PALETTE,
    normalizeFavoriteCharacterName,
    validateFavoriteCharacters,
};
