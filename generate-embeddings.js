/**
 * Script standalone para generar embeddings iniciales de todas las series.
 * Ejecutar una sola vez: node generate-embeddings.js
 */
require('dotenv').config();
const { initDB, dbAvailable, getPool } = require('./db');
const { buildEmbeddingText, getEmbeddings, upsertSeriesEmbedding } = require('./embeddings');

const API_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmNjc0Y2UzOS1hZDYxLTRhMGMtODBjNi04NjIxNGJjMDlmNWMiLCJpYXQiOjE3NzE3MzkzOTgsImV4cCI6MjA4NzMxNTM5OH0.SAqwnrGRPZ0HfQKaxFNu9VhrOhudGYcgsttt9sKdxXk';

async function fetchAllSeries() {
    const allSeries = [];
    let page = 1;

    while (true) {
        const res = await fetch(`https://manhwaimperial.site/api/series?limit=100&page=${page}`, {
            headers: {
                'Origin': 'https://manhwaimperial.site',
                'Authorization': API_TOKEN
            }
        });
        const data = await res.json();
        const batch = data.data?.series || [];
        if (batch.length === 0) break;
        allSeries.push(...batch);
        console.log(`Descargadas ${allSeries.length} series (pagina ${page})...`);
        page++;
    }

    return allSeries;
}

async function main() {
    console.log('=== Generador de Embeddings ===\n');

    // 1. Inicializar DB
    console.log('Conectando a PostgreSQL...');
    const dbOk = await initDB();
    if (!dbOk || !dbAvailable()) {
        console.error('ERROR: No se pudo conectar a PostgreSQL. Verifica DATABASE_URL en .env');
        process.exit(1);
    }
    console.log('PostgreSQL conectado.\n');

    // 2. Descargar series
    console.log('Descargando series de la API...');
    const series = await fetchAllSeries();
    console.log(`Total series: ${series.length}\n`);

    if (series.length === 0) {
        console.error('No se encontraron series.');
        process.exit(1);
    }

    // 3. Verificar cuáles ya tienen embedding
    const pool = getPool();
    const existingResult = await pool.query('SELECT id FROM series_embeddings');
    const existingIds = new Set(existingResult.rows.map(r => r.id));
    const pending = series.filter(s => !existingIds.has(s.id));

    console.log(`Series con embedding existente: ${existingIds.size}`);
    console.log(`Series pendientes: ${pending.length}\n`);

    if (pending.length === 0) {
        console.log('Todas las series ya tienen embedding. Nada que hacer.');
        process.exit(0);
    }

    // 4. Generar embeddings en batches
    const BATCH_SIZE = 50;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

        console.log(`Batch ${batchNum}/${totalBatches} (${batch.length} series)...`);

        try {
            const texts = batch.map(s => buildEmbeddingText(s));
            const embeddings = await getEmbeddings(texts);

            for (let j = 0; j < batch.length; j++) {
                try {
                    await upsertSeriesEmbedding(batch[j].id, batch[j].title, texts[j], embeddings[j]);
                    processed++;
                } catch (err) {
                    errors++;
                    console.error(`  Error upsert ${batch[j].title}: ${err.message}`);
                }
            }

            console.log(`  OK: ${processed}/${pending.length} procesadas, ${errors} errores`);
        } catch (err) {
            errors += batch.length;
            console.error(`  Error en batch: ${err.message}`);
            // Pausa larga si hay error (posible rate limit)
            console.log('  Esperando 5s antes de reintentar...');
            await new Promise(r => setTimeout(r, 5000));
            continue;
        }

        // Pausa de 1s entre batches
        if (i + BATCH_SIZE < pending.length) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // 5. Resumen
    console.log('\n=== Resultado ===');
    console.log(`Procesadas: ${processed}`);
    console.log(`Errores: ${errors}`);
    console.log(`Total en DB: ${existingIds.size + processed}`);

    // Cerrar pool
    await pool.end();
    console.log('\nConexion cerrada. Listo!');
}

main().catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
});
