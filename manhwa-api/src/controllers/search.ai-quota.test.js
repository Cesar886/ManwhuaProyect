jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const { aiRead } = require('./search.controller');

const request = (user = null) => ({
    user,
    body: { messages: [{ role: 'user', content: 'test' }] },
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    get: () => 'test-agent',
});

const response = () => {
    const res = { statusCode: 200, headers: {}, status: jest.fn(), set: jest.fn(), json: jest.fn() };
    res.status.mockImplementation((code) => { res.statusCode = code; return res; });
    res.set.mockImplementation((key, value) => { res.headers[key] = value; return res; });
    return res;
};

describe('aiRead daily tier quota', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, headers: { get: () => 'application/json' }, text: async () => '{"ok":true}' });
    });

    test('fails closed on quota DB error without calling IA', async () => {
        query.mockRejectedValueOnce(new Error('db down'));
        const res = response();
        await aiRead(request(), res);
        expect(res.statusCode).toBe(503);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test.each([
        ['guest', null, 5],
        ['user', { id: 10, role: 'user', isPremium: false }, 15],
        ['vip', { id: 11, role: 'vip', isPremium: false }, 35],
    ])('%s is blocked at its daily limit', async (tier, user, limit) => {
        if (user) query.mockResolvedValueOnce({ rows: [{ role: user.role, is_premium: user.isPremium, premium_until: null }] });
        query.mockResolvedValueOnce({ rows: [] });
        const res = response();
        await aiRead(request(user), res);
        expect(res.statusCode).toBe(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ limit, tier, remaining: 0 }));
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
