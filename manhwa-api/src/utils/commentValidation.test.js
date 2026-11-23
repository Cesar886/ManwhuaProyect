const { normalizeWallComment, validateWallComment } = require('./commentValidation');

describe('wall comment validation', () => {
    test('allows HTML-like text and React escapes it', () => {
        const result = validateWallComment({ content: '<b>hola</b>', rating: null, isSpoiler: false, poll: null });
        expect(result).toEqual({ normalized: '<b>hola</b>' });
    });

    test('removes control characters and normalizes whitespace', () => {
        expect(normalizeWallComment('  hola\u0000  mundo \n amigo  ')).toBe('hola mundo amigo');
    });

    test('rejects empty content', () => {
        expect(validateWallComment({ content: '   \n', rating: null }).code).toBe('CONTENT_EMPTY');
    });

    test('rejects content over 500 characters', () => {
        expect(validateWallComment({ content: 'a'.repeat(501), rating: null }).code).toBe('CONTENT_TOO_LONG');
    });

    test.each([
        ['rating', { rating: 5 }],
        ['isSpoiler', { isSpoiler: true }],
        ['poll', { poll: { question: 'Pregunta', options: ['Sí', 'No'] } }],
    ])('rejects forbidden wall field %s', (field, extra) => {
        expect(validateWallComment({ content: 'hola', ...extra })).toEqual({
            code: 'FIELD_NOT_ALLOWED',
            field,
        });
    });
});
