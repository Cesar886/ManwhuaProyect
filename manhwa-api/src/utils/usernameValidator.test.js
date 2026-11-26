const {
    normalizeUsername,
    validateUsername,
    validateDisplayName,
    isUsernameAvailable,
} = require('./usernameValidator');

describe('usernameValidator', () => {
    test('normalizes common leetspeak and separators', () => {
        expect(normalizeUsername(' Adm1n_Test ')).toBe('admintest');
    });

    test('accepts a normal username', () => {
        const result = validateUsername('lector_99');
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test.each(['admin', 'Adm1n', '12345', 'user__name', 'user_'])('rejects %s', (username) => {
        expect(validateUsername(username).valid).toBe(false);
    });

    test.each(['admin', 'Adm1n', 'Admín', 'super admin', 'Juan Admin', 'Soporte María', 'moderador', 'support', 'official', 'password'])('rejects reserved display name %s', (name) => {
        expect(validateDisplayName(name).valid).toBe(false);
    });

    test.each(['Ana María', 'Lector Nocturno', 'Sofía'])('accepts ordinary display name %s', (name) => {
        expect(validateDisplayName(name).valid).toBe(true);
    });

    test('reports a username already stored in the database', async () => {
        const query = jest.fn().mockResolvedValue({ rows: [{ id: 42 }] });
        const result = await isUsernameAvailable('lector_99', query);

        expect(result.available).toBe(false);
        expect(query).toHaveBeenCalledWith(
            'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
            ['lector_99'],
        );
    });

    test('excludes the current user when checking an update', async () => {
        const query = jest.fn().mockResolvedValue({ rows: [] });
        const result = await isUsernameAvailable('lector_99', query, 42);

        expect(result).toEqual({ available: true, username: 'lector_99' });
        expect(query.mock.calls[0][0]).toContain('id != $2');
        expect(query.mock.calls[0][1]).toEqual(['lector_99', 42]);
    });
});
