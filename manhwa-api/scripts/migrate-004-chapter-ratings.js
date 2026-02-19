#!/usr/bin/env node

/**
 * Migración 004: Reconstruir chapter_ratings para usar (series_slug, chapter_number)
 * en lugar de chapter_id (FK a chapters, que siempre está vacía).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, testConnection } = require('../src/config/database');

async function runMigration() {
    try {
        console.log('Iniciando migración 004: Rebuild chapter_ratings...');

        await testConnection();

        const sqlPath = path.join(__dirname, '../migrations/004_rebuild_chapter_ratings.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Ejecutando SQL...');
        await query(sql);

        console.log('Migración 004 completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando migración 004:', error);
        process.exit(1);
    }
}

runMigration();
