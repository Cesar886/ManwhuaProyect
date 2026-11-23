const WALL_TARGET_ID = '00000000-0000-0000-0000-000000000000';

const normalizeWallComment = (content) => {
    if (typeof content !== 'string') return '';
    return content
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
        .replace(/\s+/gu, ' ')
        .trim();
};

const validateWallComment = ({ content, rating, isSpoiler, poll }) => {
    const normalized = normalizeWallComment(content);
    if (!normalized) return { code: 'CONTENT_EMPTY' };
    if ([...normalized].length > 500) return { code: 'CONTENT_TOO_LONG' };
    if (rating !== undefined && rating !== null) return { code: 'FIELD_NOT_ALLOWED', field: 'rating' };
    if (isSpoiler === true) return { code: 'FIELD_NOT_ALLOWED', field: 'isSpoiler' };
    if (poll !== undefined && poll !== null) return { code: 'FIELD_NOT_ALLOWED', field: 'poll' };
    return { normalized };
};

module.exports = { WALL_TARGET_ID, normalizeWallComment, validateWallComment };
