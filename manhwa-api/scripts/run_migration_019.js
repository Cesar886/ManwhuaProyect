require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../src/config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/019_add_user_banner_position.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 019...');
        await query(sql);
        console.log('Migration 019 completed successfully.');
    } catch (error) {
        console.error('Migration 019 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
