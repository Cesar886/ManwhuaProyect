require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../src/config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/014_restore_comment_tables.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 014...');
        await query(sql);
        console.log('Migration 014 completed successfully.');
    } catch (error) {
        console.error('Migration 014 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
