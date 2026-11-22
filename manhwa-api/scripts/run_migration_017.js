require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { pool, query } = require('../src/config/database');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/017_repair_runtime_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 017...');
        await query(sql);
        console.log('Migration 017 completed successfully.');
    } catch (error) {
        console.error('Migration 017 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration();
