const { query, transaction } = require('../config/database');
const { customAlphabet } = require('nanoid');
const slugify = require('slugify');

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 8);
const MIN_TITLES = Math.max(1, Number.parseInt(process.env.MIN_INDEXABLE_COLLECTION_TITLES, 10) || 5);
const notFound = (res) => res.status(404).json({ success: false, message: 'Colección no encontrada' });
const noStore = (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('Vary', 'Cookie');
    next();
};
const urlSlug = (name) => slugify(name, { lower: true, strict: true }) || 'coleccion';
const present = (c, viewerId) => ({
    id: c.id,
    publicId: c.public_id,
    slug: urlSlug(c.name),
    name: c.name,
    description: c.description,
    coverUrl: c.cover_url,
    type: c.type,
    visibility: c.visibility,
    isPublic: c.visibility === 'public',
    copiedFrom: c.original_visibility === 'public' && c.original_deleted_at === null && c.original_user_status === 'active'
        ? { username: c.original_username, publicId: c.original_public_id, slug: urlSlug(c.original_name), type: c.original_type }
        : null,
    creator: c.username ? { username: c.username, displayName: c.display_name, avatarUrl: c.avatar_url } : undefined,
    stats: { manhwas: Number(c.active_count ?? c.manhwas_count), likes: Number(c.likes_count) },
    manhwasCount: Number(c.active_count ?? c.manhwas_count),
    likesCount: Number(c.likes_count),
    userInteraction: { isLiked: Boolean(c.user_liked), isOwner: viewerId === c.creator_id },
    previewSeries: c.preview_series || [],
    createdAt: c.created_at,
    updatedAt: c.updated_at,
});
const detailSelect = `SELECT c.*, u.username, u.display_name, u.avatar_url,
    (SELECT COUNT(*) FROM collection_items ci JOIN series s ON s.id=ci.series_id
     WHERE ci.collection_id=c.id AND s.deleted_at IS NULL) AS active_count,
    EXISTS (SELECT 1 FROM collection_likes cl WHERE cl.collection_id = c.id AND cl.user_id = $2) AS user_liked,
    original.visibility AS original_visibility, original.deleted_at AS original_deleted_at,
    original.name AS original_name, original.public_id AS original_public_id, original.type AS original_type,
    original_user.username AS original_username, original_user.status AS original_user_status
    FROM collections c JOIN users u ON u.id = c.creator_id
    LEFT JOIN collections original ON original.id = c.copied_from_id
    LEFT JOIN users original_user ON original_user.id = original.creator_id`;

async function findVisible(publicId, viewerId, db = query) {
    const result = await db(
        `${detailSelect} WHERE c.public_id = $1 AND c.deleted_at IS NULL
        AND u.deleted_at IS NULL AND u.status = 'active'
        AND (c.visibility <> 'private' OR c.creator_id = $2)`,
        [publicId, viewerId || null]
    );
    return result.rows[0];
}
async function findOwned(publicId, ownerId, db = query) {
    const result = await db(
        'SELECT * FROM collections WHERE public_id = $1 AND creator_id = $2 AND deleted_at IS NULL',
        [publicId, ownerId]
    );
    return result.rows[0];
}
async function withIdRetry(callback) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const publicId = nanoid();
        try {
            return await transaction((client) => callback(client, publicId));
        } catch (error) {
            if (error.code === '23505' && /public_id|collections_slug_key/.test(error.constraint || '')) continue;
            throw error;
        }
    }
    throw new Error('No se pudo generar un identificador único');
}
const wrap = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);

const mine = wrap(async (req, res) => {
    const result = await query(
        `SELECT c.*, EXISTS(SELECT 1 FROM collection_items ci WHERE ci.collection_id=c.id AND ci.series_id=$2) AS contains_series,
        (SELECT json_agg(json_build_object('id', s.id, 'title', s.title, 'slug', s.slug, 'coverUrl', s.cover_url))
        FROM (SELECT s.id,s.title,s.slug,s.cover_url FROM collection_items ci JOIN series s ON s.id=ci.series_id
        WHERE ci.collection_id=c.id AND s.deleted_at IS NULL ORDER BY ci.order_index LIMIT 4) s) AS preview_series
        FROM collections c WHERE c.creator_id=$1 AND c.deleted_at IS NULL ORDER BY (c.type='favorites') DESC,c.created_at DESC`,
        [req.user.id, req.query.seriesId || null]
    );
    res.json({ success: true, data: { collections: result.rows.map(c => ({
        ...present(c, req.user.id), legacySlug: c.slug, containsSeries: c.contains_series,
    })) } });
});

const list = wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const result = await query(
        `SELECT c.*,u.username,u.display_name,u.avatar_url,
        (SELECT COUNT(*) FROM collection_items ci JOIN series s ON s.id=ci.series_id
         WHERE ci.collection_id=c.id AND s.deleted_at IS NULL) AS active_count,
        (SELECT json_agg(json_build_object('title', preview.title, 'slug', preview.slug, 'coverUrl', preview.cover_url))
         FROM (SELECT s.title,s.slug,s.cover_url FROM collection_items ci JOIN series s ON s.id=ci.series_id
               WHERE ci.collection_id=c.id AND s.deleted_at IS NULL ORDER BY ci.order_index LIMIT 1) preview) AS preview_series
        FROM collections c JOIN users u ON u.id=c.creator_id
        WHERE c.visibility='public' AND c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.status='active'
        ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`, [limit, (page - 1) * limit]
    );
    const count = await query(
        `SELECT COUNT(*) FROM collections c JOIN users u ON u.id=c.creator_id
        WHERE c.visibility='public' AND c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.status='active'`
    );
    const total = Number(count.rows[0].count);
    res.json({ success: true, data: { collections: result.rows.map(c => present(c, req.user?.id)),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

const indexable = wrap(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const result = await query(
        `SELECT c.public_id,c.name,c.type,u.username,c.updated_at FROM collections c JOIN users u ON u.id=c.creator_id
        WHERE c.visibility='public' AND c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.status='active'
        AND (SELECT COUNT(*) FROM collection_items ci JOIN series s ON s.id=ci.series_id
             WHERE ci.collection_id=c.id AND s.deleted_at IS NULL) >= $1
        ORDER BY c.id LIMIT 500 OFFSET $2`, [MIN_TITLES, (page - 1) * 500]
    );
    res.json({ success: true, data: { collections: result.rows.map(c => ({
        publicId: c.public_id, slug: urlSlug(c.name), type: c.type, username: c.username, updatedAt: c.updated_at,
    })), hasMore: result.rowCount === 500 } });
});

const get = wrap(async (req, res) => {
    const c = await findVisible(req.params.publicId, req.user?.id);
    if (!c) return notFound(res);
    res.json({ success: true, data: { collection: present(c, req.user?.id) } });
});

const items = wrap(async (req, res) => {
    const c = await findVisible(req.params.publicId, req.user?.id);
    if (!c) return notFound(res);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await query(
        `SELECT s.id,s.title,s.slug,s.cover_url,s.status,s.rating_average,s.chapter_count,s.content_type,
        ci.order_index,ci.note FROM collection_items ci JOIN series s ON s.id=ci.series_id
        WHERE ci.collection_id=$1 AND s.deleted_at IS NULL ORDER BY ci.order_index,ci.added_at,ci.series_id
        LIMIT $2 OFFSET $3`, [c.id, limit, (page - 1) * limit]
    );
    const count = await query(
        'SELECT COUNT(*) FROM collection_items ci JOIN series s ON s.id=ci.series_id WHERE ci.collection_id=$1 AND s.deleted_at IS NULL',
        [c.id]
    );
    const total = Number(count.rows[0].count);
    res.json({ success: true, data: { manhwas: result.rows.map(s => ({
        id: s.id, title: s.title, slug: s.slug, coverUrl: s.cover_url, status: s.status,
        rating: Number(s.rating_average), chapterCount: s.chapter_count, contentType: s.content_type,
        orderIndex: s.order_index, note: s.note,
    })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

const comments = wrap(async (req, res) => {
    const c = await findVisible(req.params.publicId, req.user?.id);
    if (!c) return notFound(res);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const result = await query(
        `SELECT cm.*,u.username,u.display_name,u.avatar_url,u.role AS user_role,u.experience,u.is_premium AS author_is_premium
         FROM comments cm JOIN users u ON u.id=cm.user_id
         WHERE cm.target_type='collection' AND cm.target_id=$1 AND cm.parent_id IS NULL AND cm.status='visible'
         ORDER BY cm.created_at DESC LIMIT $2 OFFSET $3`, [c.id, limit, (page - 1) * limit]
    );
    const count = await query(
        "SELECT COUNT(*) FROM comments WHERE target_type='collection' AND target_id=$1 AND parent_id IS NULL AND status='visible'", [c.id]
    );
    const total = Number(count.rows[0].count);
    res.json({ success: true, data: { comments: result.rows.map(item => ({
        id: item.id, content: item.content,
        author: { username: item.username, displayName: item.display_name, avatarUrl: item.avatar_url,
            role: item.user_role, isPremium: item.author_is_premium, experience: Number(item.experience) || 0 },
        likes: item.likes_count, repliesCount: item.replies_count, createdAt: item.created_at,
    })), pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
});

const create = wrap(async (req, res) => {
    const name = req.body.name.trim();
    const row = await withIdRetry((client, publicId) => client.query(
        `INSERT INTO collections (creator_id,name,slug,description,cover_url,type,visibility,is_public,public_id)
        VALUES ($1,$2,$3,$4,$5,'normal','private',false,$6) RETURNING *`,
        [req.user.id, name, `${urlSlug(name)}-${publicId}`, req.body.description || null,
            req.body.coverUrl || null, publicId]
    ).then(r => r.rows[0]));
    await query('UPDATE users SET collections_count=collections_count+1 WHERE id=$1', [req.user.id]);
    res.status(201).json({ success: true, data: { collection: present(row, req.user.id) } });
});

const update = wrap(async (req, res) => {
    const c = await findOwned(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    const { name, description, coverUrl, visibility } = req.body;
    const result = await query(
        `UPDATE collections SET name=COALESCE($1,name),description=COALESCE($2,description),
        cover_url=COALESCE($3,cover_url),visibility=COALESCE($4,visibility),
        is_public=(COALESCE($4,visibility)='public'),updated_at=now() WHERE id=$5 RETURNING *`,
        [name ?? null, description ?? null, coverUrl ?? null, visibility ?? null, c.id]
    );
    res.json({ success: true, data: { collection: present(result.rows[0], req.user.id) } });
});

const remove = wrap(async (req, res) => {
    const c = await findOwned(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    if (c.type === 'favorites') return res.status(400).json({ success: false, message: 'Favoritos no se puede borrar' });
    await transaction(async client => {
        await client.query('UPDATE collections SET deleted_at=now(),updated_at=now() WHERE id=$1', [c.id]);
        await client.query('UPDATE users SET collections_count=GREATEST(0,collections_count-1) WHERE id=$1', [req.user.id]);
    });
    res.json({ success: true });
});

const addItem = wrap(async (req, res) => {
    const c = await findOwned(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    const series = await query('SELECT 1 FROM series WHERE id=$1 AND deleted_at IS NULL', [req.body.seriesId]);
    if (!series.rowCount) return res.status(404).json({ success: false, message: 'Serie no encontrada' });
    if (c.type === 'favorites') {
        await query(`INSERT INTO bookmarks (user_id,series_id,is_favorite) VALUES ($1,$2,true)
            ON CONFLICT (user_id,series_id) DO UPDATE SET is_favorite=true,updated_at=now()`,
            [req.user.id, req.body.seriesId]);
    } else {
        await transaction(async client => {
            await client.query('SELECT id FROM collections WHERE id=$1 FOR UPDATE', [c.id]);
            await client.query(`INSERT INTO collection_items (collection_id,series_id,order_index,added_by)
                VALUES ($1,$2,(SELECT COALESCE(MAX(order_index)+1,0) FROM collection_items WHERE collection_id=$1),$3)
                ON CONFLICT (collection_id,series_id) DO NOTHING`, [c.id, req.body.seriesId, req.user.id]);
            await client.query('UPDATE collections SET manhwas_count=(SELECT COUNT(*) FROM collection_items WHERE collection_id=$1),updated_at=now() WHERE id=$1', [c.id]);
        });
    }
    res.json({ success: true });
});

const removeItem = wrap(async (req, res) => {
    const c = await findOwned(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    if (c.type === 'favorites') {
        await query('UPDATE bookmarks SET is_favorite=false,updated_at=now() WHERE user_id=$1 AND series_id=$2',
            [req.user.id, req.params.seriesId]);
    } else {
        await transaction(async client => {
            await client.query('DELETE FROM collection_items WHERE collection_id=$1 AND series_id=$2', [c.id, req.params.seriesId]);
            await client.query('UPDATE collections SET manhwas_count=(SELECT COUNT(*) FROM collection_items WHERE collection_id=$1),updated_at=now() WHERE id=$1', [c.id]);
        });
    }
    res.json({ success: true });
});

const reorder = wrap(async (req, res) => {
    const c = await findOwned(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    const ids = req.body.seriesIds;
    if (new Set(ids).size !== ids.length) return res.status(400).json({ success: false, message: 'Orden duplicado' });
    await transaction(async client => {
        const current = await client.query('SELECT series_id FROM collection_items WHERE collection_id=$1 FOR UPDATE', [c.id]);
        if (current.rowCount !== ids.length || current.rows.some(row => !ids.includes(row.series_id))) {
            const error = new Error('El orden debe incluir todas las obras'); error.status = 400; throw error;
        }
        for (let i = 0; i < ids.length; i++) {
            await client.query('UPDATE collection_items SET order_index=$1 WHERE collection_id=$2 AND series_id=$3', [i, c.id, ids[i]]);
        }
        await client.query('UPDATE collections SET updated_at=now() WHERE id=$1', [c.id]);
    });
    res.json({ success: true });
});

const like = (add) => wrap(async (req, res) => {
    const c = await findVisible(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    const count = await transaction(async client => {
        const changed = add
            ? await client.query('INSERT INTO collection_likes (user_id,collection_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1', [req.user.id, c.id])
            : await client.query('DELETE FROM collection_likes WHERE user_id=$1 AND collection_id=$2 RETURNING 1', [req.user.id, c.id]);
        if (changed.rowCount) await client.query('UPDATE collections SET likes_count=GREATEST(0,likes_count+$1) WHERE id=$2', [add ? 1 : -1, c.id]);
        const result = await client.query('SELECT likes_count FROM collections WHERE id=$1', [c.id]);
        return result.rows[0].likes_count;
    });
    res.json({ success: true, data: { isLiked: add, likesCount: count } });
});

const follow = (add) => wrap(async (req, res) => {
    const c = await findVisible(req.params.publicId, req.user.id);
    if (!c) return notFound(res);
    await transaction(async client => {
        const changed = add
            ? await client.query('INSERT INTO collection_follows (user_id,collection_id) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING 1', [req.user.id, c.id])
            : await client.query('DELETE FROM collection_follows WHERE user_id=$1 AND collection_id=$2 RETURNING 1', [req.user.id, c.id]);
        if (changed.rowCount) await client.query('UPDATE collections SET followers_count=GREATEST(0,followers_count+$1) WHERE id=$2', [add ? 1 : -1, c.id]);
    });
    res.json({ success: true });
});

const copy = wrap(async (req, res) => {
    const source = await findVisible(req.params.publicId, req.user.id);
    if (!source) return notFound(res);
    const name = `${source.name} (copia)`.slice(0, 200);
    const row = await withIdRetry(async (client, publicId) => {
        const locked = await client.query(
            `SELECT c.* FROM collections c JOIN users u ON u.id=c.creator_id
             WHERE c.id=$1 AND c.deleted_at IS NULL AND u.deleted_at IS NULL AND u.status='active'
             AND (c.visibility <> 'private' OR c.creator_id=$2) FOR SHARE OF c`,
            [source.id, req.user.id]
        );
        if (!locked.rowCount) {
            const error = new Error('Colección no encontrada'); error.status = 404; throw error;
        }
        const current = locked.rows[0];
        const created = await client.query(
            `INSERT INTO collections (creator_id,name,slug,description,cover_url,type,visibility,is_public,public_id,copied_from_id)
             VALUES ($1,$2,$3,$4,$5,'normal','private',false,$6,$7) RETURNING *`,
            [req.user.id, name, `${urlSlug(name)}-${publicId}`, current.description,
                current.cover_url, publicId, current.id]
        );
        await client.query(
            `INSERT INTO collection_items (collection_id,series_id,order_index,added_by,note)
             SELECT $1,ci.series_id,ci.order_index,$2,ci.note FROM collection_items ci
             WHERE ci.collection_id=$3 ORDER BY ci.order_index,ci.series_id`,
            [created.rows[0].id, req.user.id, current.id]
        );
        const updated = await client.query('UPDATE collections SET manhwas_count=(SELECT COUNT(*) FROM collection_items WHERE collection_id=$1) WHERE id=$1 RETURNING *', [created.rows[0].id]);
        await client.query('UPDATE users SET collections_count=collections_count+1 WHERE id=$1', [req.user.id]);
        return updated.rows[0];
    });
    res.status(201).json({ success: true, data: { collection: present(row, req.user.id) } });
});

module.exports = { MIN_TITLES, noStore, mine, list, indexable, get, items, create, update, remove,
    addItem, removeItem, reorder, like, follow, comments, copy, findVisible, present };
