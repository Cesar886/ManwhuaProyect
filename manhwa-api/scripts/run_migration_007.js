require('dotenv').config();

const { query, pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/007_add_user_profile_fields.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 007...');
        await query(sql);
        console.log('Migration 007 completed successfully.');
    } catch (error) {
        console.error('Migration 007 failed:', error);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

runMigration().then(() => process.exit(process.exitCode || 0));
