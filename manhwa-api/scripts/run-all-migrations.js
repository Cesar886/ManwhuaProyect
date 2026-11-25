require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

const migrations = [
    '001_add_oauth_columns.sql',
    '002_add_reading_progress_fields.sql',
    '003_add_chapter_ratings.sql',
    '004_rebuild_chapter_ratings.sql',
    '005_behavioral_tracking_system.sql',
    '../db/behavioral_analytics_schema.sql',
    '006_behavioral_confidence_constraints.sql',
    '007_add_user_profile_fields.sql',
    '008_add_reading_history_timestamps.sql',
    '009_add_scraper_series_fields.sql',
    '010_add_genre_display_fields.sql',
    '011_add_requests_tables.sql',
    '012_allow_request_comments.sql',
    '013_add_active_reader_privacy.sql',
    '014_restore_comment_tables.sql',
    '015_create_user_follows.sql',
    '016_create_series_ratings.sql',
    '017_repair_runtime_schema.sql',
    '018_add_social_links_and_follow_counts.sql',
    '019_add_user_banner_position.sql',
    '../db/add_polls.sql',
    '020_add_push_subscriptions.sql',
    '021_create_notifications.sql',
    '022_add_user_favorite_characters.sql',
    '023_create_wall_posts.sql',
    '024_add_user_profile_appearance.sql',
    '025_expand_favorite_character_names.sql',
    '026_harden_wall_comments.sql',
    '027_create_ai_usage_daily.sql',
    '028_add_manhwa_recommendations_to_comments.sql',
    '029_add_recommended_series_slug.sql',
];

function loadMigrations() {
    return migrations.map((migration) => {
        let sqlPath;
        if (migration.startsWith('../')) {
            sqlPath = path.resolve(
                __dirname,
                '..',
                migration.replace(/^\.\.\//, ''),
            );
        } else {
            sqlPath = path.join(__dirname, '..', 'migrations', migration);
        }

        try {
            const sql = fs.readFileSync(sqlPath, 'utf8');
            const name = migration.replaceAll('\\', '/');
            return { name, sql };
        } catch (error) {
            throw new Error(`Cannot load migration "${migration}" at "${sqlPath}": ${error.message}`);
        }
    });
}

async function runMigrations() {
    let client;
    try {
        const loadedMigrations = loadMigrations();
        client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);

        for (const { name, sql } of loadedMigrations) {
            const applied = await client.query(
                'SELECT 1 FROM schema_migrations WHERE name = $1',
                [name],
            );

            if (applied.rowCount > 0) {
                console.log(`Skipping migration ${name} (already applied).`);
                continue;
            }

            console.log(`Running migration ${name}...`);
            await client.query(sql);
            await client.query(
                'INSERT INTO schema_migrations (name) VALUES ($1)',
                [name],
            );
            console.log(`Migration ${name} completed.`);
        }
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exitCode = 1;
    } finally {
        client?.release();
        await pool.end();
    }
}

runMigrations();
