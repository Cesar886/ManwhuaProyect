#!/usr/bin/env node

/**
 * Script para ejecutar la migración de encuestas
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, testConnection } = require('../src/config/database');

async function runMigration() {
    try {
        console.log('🔄 Iniciando migración de encuestas...');
        
        // Probar conexión
        await testConnection();
        
        // Leer archivo SQL
        const sqlPath = path.join(__dirname, '../db/add_polls.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        // Ejecutar SQL
        console.log('📝 Ejecutando SQL...');
        await query(sql);
        
        console.log('✅ Migración completada exitosamente');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error ejecutando migración:', error);
        process.exit(1);
    }
}

runMigration();
