require('dotenv').config();

const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/013_add_active_reader_privacy.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Running migration 013...');
        await query(sql);
        console.log('Migration 013 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration 013 failed:', error);
        process.exit(1);
    }
}

runMigration();
