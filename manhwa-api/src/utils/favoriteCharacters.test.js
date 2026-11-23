const {
    validateFavoriteCharacters,
    FAVORITE_CHARACTER_PALETTE,
} = require('./favoriteCharacters');

describe('validateFavoriteCharacters', () => {
    test('rechaza más de tres personajes', () => {
        const characters = [0, 1, 2, 3].map(position => ({
            type: 'waifu',
            name: 'Asuna',
            color: FAVORITE_CHARACTER_PALETTE[0],
            position,
        }));

        expect(validateFavoriteCharacters(characters).some(error =>
            error.field === 'favoriteCharacters'
        )).toBe(true);
    });

    test('rechaza tipos inválidos', () => {
        const result = validateFavoriteCharacters([{
            type: 'best-friend',
            name: 'Asuna',
            color: FAVORITE_CHARACTER_PALETTE[0],
            position: 0,
        }]);

        expect(result).toContainEqual(expect.objectContaining({
            field: 'favoriteCharacters.0.type',
        }));
    });

    test('rechaza nombres vacíos', () => {
        const result = validateFavoriteCharacters([{
            type: 'waifu',
            name: '   ',
            color: FAVORITE_CHARACTER_PALETTE[0],
            position: 0,
        }]);

        expect(result).toContainEqual(expect.objectContaining({
            field: 'favoriteCharacters.0.name',
        }));
    });

    test('rechaza HTML y scripts', () => {
        const htmlResult = validateFavoriteCharacters([{
            type: 'waifu',
            name: '<b>Asuna</b>',
            color: FAVORITE_CHARACTER_PALETTE[0],
            position: 0,
        }]);
        const scriptResult = validateFavoriteCharacters([{
            type: 'husband',
            name: 'x<script>',
            color: FAVORITE_CHARACTER_PALETTE[0],
            position: 0,
        }]);

        expect(htmlResult).toContainEqual(expect.objectContaining({
            field: 'favoriteCharacters.0.name',
        }));
        expect(scriptResult).toContainEqual(expect.objectContaining({
            field: 'favoriteCharacters.0.name',
        }));
    });

    test('cuenta caracteres reales, no unidades UTF-16', () => {
        const result = validateFavoriteCharacters([{
            type: 'waifu',
            name: 'A🌸BC',
            color: FAVORITE_CHARACTER_PALETTE[0],
            position: 0,
        }]);

        expect(Array.isArray(result)).toBe(true);
        expect(result).not.toEqual(expect.arrayContaining([
            expect.objectContaining({ field: 'favoriteCharacters.0.name' }),
        ]));
    });

    test('rechaza colores fuera de la paleta', () => {
        const result = validateFavoriteCharacters([{
            type: 'waifu',
            name: 'Asuna',
            color: '#123456',
            position: 0,
        }]);

        expect(result).toContainEqual(expect.objectContaining({
            field: 'favoriteCharacters.0.color',
        }));
    });

    test('normaliza nombres y colores válidos', () => {
        const result = validateFavoriteCharacters([{
            type: 'waifu',
            name: '  Asuna  ',
            color: '#e64980',
            position: 0,
        }]);

        expect(result).toEqual([{
            type: 'waifu',
            name: 'Asuna',
            color: '#F9A8D4',
            position: 0,
        }]);
    });
});
