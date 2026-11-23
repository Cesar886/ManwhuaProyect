-- Read-only verification of denormalized comment counters.
-- It reports mismatches against comment_votes and comments replies.

SELECT
    c.id,
    c.likes_count AS stored_likes,
    COALESCE(real_votes.likes, 0) AS real_likes,
    c.dislikes_count AS stored_dislikes,
    COALESCE(real_votes.dislikes, 0) AS real_dislikes,
    c.replies_count AS stored_replies,
    COALESCE(real_replies.replies, 0) AS real_replies
FROM public.comments c
LEFT JOIN (
    SELECT
        comment_id,
        COUNT(*) FILTER (WHERE vote_type = 1) AS likes,
        COUNT(*) FILTER (WHERE vote_type = -1) AS dislikes
    FROM public.comment_votes
    GROUP BY comment_id
) real_votes ON real_votes.comment_id = c.id
LEFT JOIN (
    SELECT parent_id AS comment_id, COUNT(*) AS replies
    FROM public.comments
    WHERE status = 'visible'
    GROUP BY parent_id
) real_replies ON real_replies.comment_id = c.id
WHERE c.likes_count <> COALESCE(real_votes.likes, 0)
   OR c.dislikes_count <> COALESCE(real_votes.dislikes, 0)
   OR c.replies_count <> COALESCE(real_replies.replies, 0)
ORDER BY c.created_at DESC;
