require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../src/config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/018_add_social_links_and_follow_counts.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 018...');
        await query(sql);
        console.log('Migration 018 completed successfully.');
    } catch (error) {
        console.error('Migration 018 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
