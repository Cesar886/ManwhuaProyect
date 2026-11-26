jest.mock('../config/database', () => ({ query: jest.fn(), transaction: jest.fn() }));

const db = require('../config/database');
const collections = require('./sharedCollection.controller');

function response() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(code => { res.statusCode = code; return res; });
    res.json = jest.fn(body => { res.body = body; return res; });
    return res;
}
const run = async (handler, req) => {
    const res = response();
    const next = jest.fn(error => { throw error; });
    await handler(req, res, next);
    expect(next).not.toHaveBeenCalled();
    return res;
};
const row = (visibility = 'public') => ({
    id: 'collection-uuid', public_id: 'Ab3Def9Z', creator_id: 'alice', type: 'normal',
    name: 'Mis favoritos', description: null, cover_url: null, visibility,
    manhwas_count: 2, likes_count: 0, username: 'alice', display_name: 'Alice',
    deleted_at: null, original_visibility: null,
});

beforeEach(() => { jest.resetAllMocks(); });

test.each([
    ['guest', null], ['another user', { id: 'bob' }],
])('private collection returns 404 to %s', async (_, user) => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await run(collections.get, { params: { publicId: 'Ab3Def9Z' }, user });
    expect(res.statusCode).toBe(404);
    expect(db.query.mock.calls[0][0]).toContain("c.visibility <> 'private' OR c.creator_id = $2");
    expect(db.query.mock.calls[0][1][1]).toBe(user?.id || null);
});

test.each(['public', 'unlisted', 'private'])('%s collection is visible to its owner', async visibility => {
    db.query.mockResolvedValue({ rows: [row(visibility)], rowCount: 1 });
    const res = await run(collections.get, { params: { publicId: 'Ab3Def9Z' }, user: { id: 'alice' } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.collection.visibility).toBe(visibility);
});

test.each(['public', 'unlisted'])('%s collection is visible to a guest', async visibility => {
    db.query.mockResolvedValue({ rows: [row(visibility)], rowCount: 1 });
    const res = await run(collections.get, { params: { publicId: 'Ab3Def9Z' }, user: null });
    expect(res.statusCode).toBe(200);
});

test('another user cannot update a collection', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await run(collections.update, { params: { publicId: 'Ab3Def9Z' }, user: { id: 'bob' }, body: { visibility: 'public' } });
    expect(res.statusCode).toBe(404);
    expect(db.query).toHaveBeenCalledTimes(1);
});

test('favorites cannot be deleted', async () => {
    db.query.mockResolvedValue({ rows: [{ ...row('private'), type: 'favorites' }], rowCount: 1 });
    const res = await run(collections.remove, { params: { publicId: 'Ab3Def9Z' }, user: { id: 'alice' } });
    expect(res.statusCode).toBe(400);
    expect(db.transaction).not.toHaveBeenCalled();
});

test('repeated likes and unlikes change the count only once', async () => {
    let liked = false;
    let count = 0;
    db.query.mockResolvedValue({ rows: [row()], rowCount: 1 });
    db.transaction.mockImplementation(callback => callback({ query: async (sql, params) => {
        if (sql.startsWith('INSERT INTO collection_likes')) {
            if (liked) return { rowCount: 0 };
            liked = true; return { rowCount: 1 };
        }
        if (sql.startsWith('DELETE FROM collection_likes')) {
            if (!liked) return { rowCount: 0 };
            liked = false; return { rowCount: 1 };
        }
        if (sql.startsWith('UPDATE collections SET likes_count')) {
            count += params[0]; return { rowCount: 1 };
        }
        if (sql.startsWith('SELECT likes_count')) return { rows: [{ likes_count: count }] };
        throw new Error(sql);
    } }));
    const req = { params: { publicId: 'Ab3Def9Z' }, user: { id: 'bob' } };
    expect((await run(collections.like(true), req)).body.data.likesCount).toBe(1);
    expect((await run(collections.like(true), req)).body.data.likesCount).toBe(1);
    expect((await run(collections.like(false), req)).body.data.likesCount).toBe(0);
    expect((await run(collections.like(false), req)).body.data.likesCount).toBe(0);
});

test('a private source cannot be copied by another user', async () => {
    db.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const res = await run(collections.copy, { params: { publicId: 'Ab3Def9Z' }, user: { id: 'bob' } });
    expect(res.statusCode).toBe(404);
    expect(db.transaction).not.toHaveBeenCalled();
});

test('copy inserts a private normal collection and ordered items in one transaction', async () => {
    const source = { ...row('unlisted'), description: 'A list' };
    db.query.mockResolvedValue({ rows: [source], rowCount: 1 });
    const statements = [];
    db.transaction.mockImplementation(callback => callback({ query: async (sql, params) => {
        statements.push([sql, params]);
        if (sql.startsWith('SELECT c.* FROM collections')) return { rows: [source], rowCount: 1 };
        if (sql.startsWith('INSERT INTO collections')) return { rows: [{ ...source, id: 'copy-uuid', public_id: params[5], creator_id: 'bob', type: 'normal', visibility: 'private', likes_count: 0, manhwas_count: 0 }] };
        if (sql.startsWith('UPDATE collections')) return { rows: [{ ...source, id: 'copy-uuid', creator_id: 'bob', type: 'normal', visibility: 'private', likes_count: 0, manhwas_count: 2 }] };
        return { rowCount: 2 };
    } }));
    const res = await run(collections.copy, { params: { publicId: 'Ab3Def9Z' }, user: { id: 'bob' } });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.collection.visibility).toBe('private');
    expect(res.body.data.collection.type).toBe('normal');
    expect(res.body.data.collection.likesCount).toBe(0);
    expect(res.body.data.collection.manhwasCount).toBe(2);
    expect(statements[0][0]).toContain("c.visibility <> 'private'");
    expect(statements[1][0]).toContain('copied_from_id');
    expect(statements[2][0]).toContain('ci.order_index');
    expect(statements[2][0]).toContain('ORDER BY ci.order_index');
    expect(db.transaction).toHaveBeenCalledTimes(1);
});
