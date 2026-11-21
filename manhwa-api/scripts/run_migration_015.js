require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../src/config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/015_create_user_follows.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 015...');
        await query(sql);
        console.log('Migration 015 completed successfully.');
    } catch (error) {
        console.error('Migration 015 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
