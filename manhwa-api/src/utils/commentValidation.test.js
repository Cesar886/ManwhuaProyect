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

    test('allows spoiler on wall posts', () => {
        expect(validateWallComment({ content: 'hola', isSpoiler: true })).toEqual({
            normalized: 'hola',
        });
    });

    test('allows polls on wall posts', () => {
        expect(validateWallComment({
            content: '',
            poll: { question: 'Pregunta', options: ['Sí', 'No'] },
        })).toEqual({ normalized: '' });
    });

    test('still rejects rating on wall posts', () => {
        expect(validateWallComment({ content: 'hola', rating: 5 })).toEqual({
            code: 'FIELD_NOT_ALLOWED',
            field: 'rating',
        });
    });
});
