require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

const migrations = [
    '007_add_user_profile_fields.sql',
    '008_add_reading_history_timestamps.sql',
    '009_add_scraper_series_fields.sql',
];

const requiredColumns = {
    users: ['banner_url', 'location', 'website', 'theme_primary_color', 'theme_accent_color', 'theme_mode', 'preferences'],
    reading_history: ['read_at', 'first_read_at'],
    series: ['in_spaces', 'origins', 'chapter_count'],
};

const requiredIndexes = [
    'idx_reading_history_user_read_at',
    'idx_reading_history_user_first_read_at',
    'idx_series_in_spaces',
    'idx_series_origins_gin',
];

async function verify(client) {
    for (const [table, columns] of Object.entries(requiredColumns)) {
        const result = await client.query(
            `SELECT column_name FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = $1
               AND column_name = ANY($2::text[])`,
            [table, columns],
        );
        const found = new Set(result.rows.map((row) => row.column_name));
        const missing = columns.filter((column) => !found.has(column));
        if (missing.length) throw new Error(`${table} is missing ${missing.join(', ')}`);
    }

    const indexResult = await client.query(
        `SELECT indexname FROM pg_indexes
         WHERE schemaname = current_schema() AND indexname = ANY($1::text[])`,
        [requiredIndexes],
    );
    const foundIndexes = new Set(indexResult.rows.map((row) => row.indexname));
    const missingIndexes = requiredIndexes.filter((index) => !foundIndexes.has(index));
    if (missingIndexes.length) throw new Error(`missing indexes ${missingIndexes.join(', ')}`);

    const result = await client.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE theme_mode IS NULL OR preferences IS NULL)::int AS invalid_users,
          (SELECT COUNT(*) FROM reading_history WHERE read_at IS NULL OR first_read_at IS NULL)::int AS invalid_history,
          (SELECT COUNT(*) FROM series WHERE in_spaces IS NULL OR origins IS NULL OR chapter_count IS NULL)::int AS invalid_series`,
    );
    const invalid = result.rows[0];
    if (invalid.invalid_users || invalid.invalid_history || invalid.invalid_series) {
        throw new Error(`unexpected NULL values ${JSON.stringify(invalid)}`);
    }
}

async function main() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const migration of migrations) {
            console.log(`Running ${migration}...`);
            const sqlPath = path.join(__dirname, '..', 'migrations', migration);
            await client.query(fs.readFileSync(sqlPath, 'utf8'));
        }
        await verify(client);
        await client.query('COMMIT');
        console.log('Migrations 007-009 applied and verified successfully.');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Migration verification failed:', error.message);
        process.exitCode = 1;
    } finally {
        client.release();
        await pool.end();
    }
}

main();
