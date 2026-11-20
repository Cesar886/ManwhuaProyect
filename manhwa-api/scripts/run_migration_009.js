require('dotenv').config();

const { query, pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/009_add_scraper_series_fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 009...');
        await query(sql);
        console.log('Migration 009 completed successfully.');
    } catch (error) {
        console.error('Migration 009 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
        process.exit(process.exitCode || 0);
    }
}

runMigration();
