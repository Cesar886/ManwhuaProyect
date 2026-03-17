/**
 * AB-TESTER v1: Migracion de campos A/B Testing
 *
 * Agrega columnas necesarias para el sistema de A/B testing
 * a las tablas/colecciones de contenido.
 *
 * Uso:
 *   node migrations/ab_test_fields.js
 *
 * Campos agregados:
 *   html_variant_a    LONGTEXT    — HTML original (copia de content_html)
 *   html_variant_b    LONGTEXT    — HTML curado por CURATOR-AGENT
 *   ab_test_active    BOOLEAN     — Test activo o no
 *   ab_test_start     DATETIME    — Inicio del test
 *   ab_test_variant_a_sessions INT — Sesiones variante A
 *   ab_test_variant_b_sessions INT — Sesiones variante B
 *   ab_winner         VARCHAR(1)  — 'a' o 'b' ganador
 *   ab_test_end       DATETIME    — Fin del test
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') })

async function migrateMySQL() {
  const mysql = require('mysql2/promise')

  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    connectionLimit: 2,
  })

  console.log(`[MIGRATION] Conectado a MySQL: ${process.env.DB_NAME}`)

  // Detectar tablas de contenido
  const [tables] = await pool.query('SHOW TABLES')
  const tableNames = tables.map(t => Object.values(t)[0])
  const contentTables = tableNames.filter(t =>
    ['pages', 'paginas', 'posts', 'series', 'manhwas'].includes(t.toLowerCase())
  )

  if (contentTables.length === 0) {
    console.error('[MIGRATION] No se encontraron tablas de contenido.')
    await pool.end()
    process.exit(1)
  }

  for (const table of contentTables) {
    console.log(`\n[MIGRATION] Procesando tabla: ${table}`)

    // Verificar columnas existentes
    const [columns] = await pool.query(`DESCRIBE ${table}`)
    const existingCols = columns.map(c => c.Field.toLowerCase())

    const migrations = [
      { col: 'html_variant_a', sql: `ALTER TABLE ${table} ADD COLUMN html_variant_a LONGTEXT` },
      { col: 'html_variant_b', sql: `ALTER TABLE ${table} ADD COLUMN html_variant_b LONGTEXT` },
      { col: 'ab_test_active', sql: `ALTER TABLE ${table} ADD COLUMN ab_test_active BOOLEAN DEFAULT FALSE` },
      { col: 'ab_test_start', sql: `ALTER TABLE ${table} ADD COLUMN ab_test_start DATETIME` },
      { col: 'ab_test_variant_a_sessions', sql: `ALTER TABLE ${table} ADD COLUMN ab_test_variant_a_sessions INT DEFAULT 0` },
      { col: 'ab_test_variant_b_sessions', sql: `ALTER TABLE ${table} ADD COLUMN ab_test_variant_b_sessions INT DEFAULT 0` },
      { col: 'ab_winner', sql: `ALTER TABLE ${table} ADD COLUMN ab_winner VARCHAR(1)` },
      { col: 'ab_test_end', sql: `ALTER TABLE ${table} ADD COLUMN ab_test_end DATETIME` },
    ]

    for (const mig of migrations) {
      if (existingCols.includes(mig.col.toLowerCase())) {
        console.log(`  [SKIP] ${mig.col} ya existe`)
      } else {
        try {
          await pool.query(mig.sql)
          console.log(`  [OK] ${mig.col} agregada`)
        } catch (err) {
          console.error(`  [ERROR] ${mig.col}: ${err.message}`)
        }
      }
    }

    // Indice para queries de tests activos
    try {
      await pool.query(`CREATE INDEX idx_ab_test_active ON ${table} (ab_test_active)`)
      console.log(`  [OK] Indice idx_ab_test_active creado`)
    } catch {
      console.log(`  [SKIP] Indice idx_ab_test_active ya existe`)
    }
  }

  await pool.end()
  console.log('\n[MIGRATION] MySQL completada.')
}

async function migrateMongoDB() {
  const { MongoClient } = require('mongodb')

  const uri = process.env.MONGODB_URI ||
    `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME}`
  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(process.env.DB_NAME)

  console.log(`[MIGRATION] Conectado a MongoDB: ${process.env.DB_NAME}`)

  const collections = await db.listCollections().toArray()
  const contentCollections = collections
    .map(c => c.name)
    .filter(n => ['pages', 'paginas', 'posts', 'series', 'manhwas'].includes(n.toLowerCase()))

  for (const collName of contentCollections) {
    console.log(`\n[MIGRATION] Procesando coleccion: ${collName}`)
    const coll = db.collection(collName)

    // MongoDB no requiere ALTER TABLE, los campos se agregan al escribir.
    // Pero creamos indice para queries de tests activos.
    try {
      await coll.createIndex({ ab_test_active: 1 }, { sparse: true })
      console.log(`  [OK] Indice ab_test_active creado`)
    } catch {
      console.log(`  [SKIP] Indice ab_test_active ya existe`)
    }

    // Inicializar defaults en documentos existentes que no tengan los campos
    const result = await coll.updateMany(
      { ab_test_active: { $exists: false } },
      {
        $set: {
          html_variant_a: null,
          html_variant_b: null,
          ab_test_active: false,
          ab_test_start: null,
          ab_test_variant_a_sessions: 0,
          ab_test_variant_b_sessions: 0,
          ab_winner: null,
          ab_test_end: null,
        },
      }
    )
    console.log(`  [OK] ${result.modifiedCount} documentos actualizados con defaults`)
  }

  await client.close()
  console.log('\n[MIGRATION] MongoDB completada.')
}

async function main() {
  const dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()
  console.log('==================================================')
  console.log('  AB-TESTER v1 — Migracion de campos A/B Testing')
  console.log(`  DB: ${dbType} | ${process.env.DB_NAME}`)
  console.log('==================================================\n')

  if (dbType === 'mysql') {
    await migrateMySQL()
  } else if (dbType === 'mongodb') {
    await migrateMongoDB()
  } else {
    console.error(`[ERROR] DB_TYPE="${dbType}" no soportado.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error(`\n[FATAL] ${err.message}`)
  process.exit(1)
})
