const { normalizeSocialLinks } = require('./socialLinks');

describe('normalizeSocialLinks', () => {
    test('normalizes handles and profile URLs', () => {
        expect(normalizeSocialLinks({
            x: '@reader_1',
            instagram: 'https://www.instagram.com/reader.one/',
            discord: 'reader.name'
        })).toEqual({
            x: 'https://x.com/reader_1',
            instagram: 'https://instagram.com/reader.one',
            discord: '@reader.name'
        });
    });

    test('allows empty values to remove links', () => {
        expect(normalizeSocialLinks({ x: '', instagram: null, discord: '' })).toEqual({
            x: null,
            instagram: null,
            discord: null
        });
    });

    test('rejects links to other domains and unsupported networks', () => {
        expect(() => normalizeSocialLinks({ x: 'https://example.com/reader' })).toThrow();
        expect(() => normalizeSocialLinks({ website: 'https://example.com' })).toThrow();
    });

    test('rejects malformed handles', () => {
        expect(() => normalizeSocialLinks({ instagram: '@contains/slash' })).toThrow();
        expect(() => normalizeSocialLinks({ discord: '@x' })).toThrow();
    });
});
