require('dotenv').config();

const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/008_add_reading_history_timestamps.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 008...');
        await query(sql);
        console.log('Migration 008 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration 008 failed:', error);
        process.exit(1);
    }
}

runMigration();
