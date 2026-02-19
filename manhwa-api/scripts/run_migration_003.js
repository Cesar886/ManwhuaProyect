const { query } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    try {
        const sqlPath = path.join(__dirname, '../migrations/003_add_chapter_ratings.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Running migration 003...');
        await query(sql);
        console.log('Migration 003 completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
