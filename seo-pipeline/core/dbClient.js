/**
 * IMPERIAL-AGENT v3: Cliente de Base de Datos — Auto-deteccion MySQL/MongoDB
 *
 * Al arrancar detecta automaticamente el tipo de DB y mapea
 * tablas/colecciones relevantes para SEO.
 *
 * Regla v2: Siempre incluir updated_by = "IMPERIAL-AGENT-v3" al escribir.
 */

const { AGENT } = require('../config/agentConfig')

let mysql = null
let MongoClient = null

try { mysql = require('mysql2/promise') } catch { /* no instalado */ }
try { ({ MongoClient } = require('mongodb')) } catch { /* no instalado */ }

const { readMemory, updateMemory } = require('./agentMemory')

let dbConnection = null
let dbType = null
let dbSchema = null

const AGENT_TAG = AGENT.NAME // "IMPERIAL-AGENT-v3"

// ── Inicializacion ──

async function initDB() {
  dbType = (process.env.DB_TYPE || 'mysql').toLowerCase()

  if (dbType === 'mysql' && mysql) {
    return initMySQL()
  } else if (dbType === 'mongodb' && MongoClient) {
    return initMongoDB()
  } else {
    console.warn(`  [DB] DB_TYPE="${dbType}" no soportado o driver no instalado.`)
    return null
  }
}

async function initMySQL() {
  try {
    dbConnection = await mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      waitForConnections: true,
      connectionLimit: 5,
      charset: 'utf8mb4',
    })

    const [tables] = await dbConnection.query('SHOW TABLES')
    const tableNames = tables.map(t => Object.values(t)[0])

    const seoTables = {}
    const candidates = {
      pages: ['pages', 'paginas', 'seo_pages', 'content_pages'],
      posts: ['posts', 'blog_posts', 'articles', 'articulos'],
      series: ['series', 'manhwas', 'comics', 'manga_series'],
      metadata: ['metadata', 'seo_metadata', 'meta', 'page_meta'],
    }

    for (const [key, names] of Object.entries(candidates)) {
      const found = tableNames.find(t => names.includes(t.toLowerCase()))
      if (found) seoTables[key] = found
    }

    const columnMap = {}
    for (const [key, tableName] of Object.entries(seoTables)) {
      const [columns] = await dbConnection.query(`DESCRIBE ${tableName}`)
      columnMap[key] = {
        table: tableName,
        columns: columns.map(c => c.Field),
        detected: {
          title: columns.find(c => /^(meta_?title|title|titulo)$/i.test(c.Field))?.Field,
          meta_description: columns.find(c => /^(meta_?description|description|descripcion)$/i.test(c.Field))?.Field,
          slug: columns.find(c => /^(slug|url_slug|permalink)$/i.test(c.Field))?.Field,
          content_html: columns.find(c => /^(content|content_html|contenido|body|html)$/i.test(c.Field))?.Field,
          schema_jsonld: columns.find(c => /^(schema|schema_jsonld|json_ld|structured_data)$/i.test(c.Field))?.Field,
          updated_at: columns.find(c => /^(updated_at|updatedAt|modified_at|fecha_actualizacion)$/i.test(c.Field))?.Field,
          updated_by: columns.find(c => /^(updated_by|updatedBy|modified_by)$/i.test(c.Field))?.Field,
        },
      }
    }

    dbSchema = { type: 'mysql', tables: seoTables, columns: columnMap }
    updateMemory('db_schema', dbSchema)
    updateMemory('db_type', 'mysql')

    console.log(`  [DB] MySQL conectado: ${process.env.DB_NAME}`)
    console.log(`  [DB] Tablas detectadas: ${Object.entries(seoTables).map(([k, v]) => `${k}=${v}`).join(', ')}`)

    return dbConnection
  } catch (err) {
    console.error(`  [DB] Error MySQL: ${err.message}`)
    return null
  }
}

async function initMongoDB() {
  try {
    const uri = process.env.MONGODB_URI ||
      `mongodb://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 27017}/${process.env.DB_NAME}`

    const client = new MongoClient(uri)
    await client.connect()
    dbConnection = client.db(process.env.DB_NAME)

    const collections = await dbConnection.listCollections().toArray()
    const collNames = collections.map(c => c.name)

    const seoCollections = {}
    const candidates = {
      pages: ['pages', 'paginas', 'seo_pages'],
      posts: ['posts', 'blog_posts', 'articles'],
      series: ['series', 'manhwas', 'comics'],
    }

    for (const [key, names] of Object.entries(candidates)) {
      const found = collNames.find(c => names.includes(c.toLowerCase()))
      if (found) seoCollections[key] = found
    }

    const fieldMap = {}
    for (const [key, collName] of Object.entries(seoCollections)) {
      const sample = await dbConnection.collection(collName).findOne()
      if (sample) {
        const fields = Object.keys(sample)
        fieldMap[key] = {
          collection: collName,
          fields,
          detected: {
            title: fields.find(f => /^(meta_?title|title|titulo)$/i.test(f)),
            meta_description: fields.find(f => /^(meta_?description|description)$/i.test(f)),
            slug: fields.find(f => /^(slug|url_slug|permalink)$/i.test(f)),
            content_html: fields.find(f => /^(content|content_html|body)$/i.test(f)),
            schema_jsonld: fields.find(f => /^(schema|schema_jsonld|json_ld)$/i.test(f)),
            updated_at: fields.find(f => /^(updated_at|updatedAt|modified_at)$/i.test(f)),
            updated_by: fields.find(f => /^(updated_by|updatedBy|modified_by)$/i.test(f)),
          },
        }
      }
    }

    dbSchema = { type: 'mongodb', collections: seoCollections, fields: fieldMap }
    updateMemory('db_schema', dbSchema)
    updateMemory('db_type', 'mongodb')

    console.log(`  [DB] MongoDB conectado: ${process.env.DB_NAME}`)
    console.log(`  [DB] Colecciones: ${Object.entries(seoCollections).map(([k, v]) => `${k}=${v}`).join(', ')}`)

    return dbConnection
  } catch (err) {
    console.error(`  [DB] Error MongoDB: ${err.message}`)
    return null
  }
}

// ── Consultas ──

function getSchema() {
  if (dbSchema) return dbSchema
  const memory = readMemory()
  return memory.db_schema || null
}

/**
 * Actualizar title y meta description en DB
 * Siempre incluye updated_by = AGENT_TAG y updated_at = NOW
 */
async function updateMeta(slug, data) {
  const schema = getSchema()
  if (!dbConnection || !schema) {
    return { success: false, error: 'DB no conectada o esquema no detectado' }
  }

  try {
    if (schema.type === 'mysql') {
      for (const [, info] of Object.entries(schema.columns)) {
        const slugCol = info.detected.slug
        if (!slugCol) continue

        const updates = []
        const values = []

        if (data.title && info.detected.title) {
          updates.push(`${info.detected.title} = ?`)
          values.push(data.title)
        }
        if (data.meta_description && info.detected.meta_description) {
          updates.push(`${info.detected.meta_description} = ?`)
          values.push(data.meta_description)
        }
        if (data.schema_jsonld && info.detected.schema_jsonld) {
          updates.push(`${info.detected.schema_jsonld} = ?`)
          values.push(typeof data.schema_jsonld === 'string' ? data.schema_jsonld : JSON.stringify(data.schema_jsonld))
        }
        // v2: Siempre updated_at y updated_by
        if (info.detected.updated_at) {
          updates.push(`${info.detected.updated_at} = NOW()`)
        }
        if (info.detected.updated_by) {
          updates.push(`${info.detected.updated_by} = ?`)
          values.push(AGENT_TAG)
        }

        if (updates.length === 0) continue

        values.push(slug)
        const [result] = await dbConnection.query(
          `UPDATE ${info.table} SET ${updates.join(', ')} WHERE ${slugCol} = ?`,
          values
        )
        if (result.affectedRows > 0) {
          return { success: true, table: info.table, rows: result.affectedRows }
        }
      }
      return { success: false, error: `Slug "${slug}" no encontrado` }

    } else if (schema.type === 'mongodb') {
      for (const [, info] of Object.entries(schema.fields)) {
        const slugField = info.detected.slug
        if (!slugField) continue

        const update = {}
        if (data.title && info.detected.title) update[info.detected.title] = data.title
        if (data.meta_description && info.detected.meta_description) update[info.detected.meta_description] = data.meta_description
        if (data.schema_jsonld && info.detected.schema_jsonld) update[info.detected.schema_jsonld] = data.schema_jsonld
        // v2: Siempre updated_at y updated_by
        if (info.detected.updated_at) update[info.detected.updated_at] = new Date()
        if (info.detected.updated_by) update[info.detected.updated_by] = AGENT_TAG

        if (Object.keys(update).length === 0) continue

        const result = await dbConnection.collection(info.collection).updateOne(
          { [slugField]: slug },
          { $set: update }
        )
        if (result.matchedCount > 0) {
          return { success: true, collection: info.collection, matched: result.matchedCount }
        }
      }
      return { success: false, error: `Slug "${slug}" no encontrado` }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Insertar nueva pagina en DB
 * Siempre incluye updated_by = AGENT_TAG
 */
async function insertPage(pageData) {
  const schema = getSchema()
  if (!dbConnection || !schema) {
    return { success: false, error: 'DB no conectada' }
  }

  try {
    if (schema.type === 'mysql') {
      const tableInfo = schema.columns.pages || schema.columns.posts
      if (!tableInfo) return { success: false, error: 'No se encontro tabla de paginas' }

      const row = {}
      if (tableInfo.detected.slug) row[tableInfo.detected.slug] = pageData.slug
      if (tableInfo.detected.title) row[tableInfo.detected.title] = pageData.meta_title
      if (tableInfo.detected.meta_description) row[tableInfo.detected.meta_description] = pageData.meta_description
      if (tableInfo.detected.content_html) row[tableInfo.detected.content_html] = pageData.contenido_html
      if (tableInfo.detected.schema_jsonld) row[tableInfo.detected.schema_jsonld] = typeof pageData.schema_jsonld === 'string' ? pageData.schema_jsonld : JSON.stringify(pageData.schema_jsonld)
      if (tableInfo.detected.updated_by) row[tableInfo.detected.updated_by] = AGENT_TAG

      const cols = Object.keys(row)
      const placeholders = cols.map(() => '?').join(', ')
      const [result] = await dbConnection.query(
        `INSERT INTO ${tableInfo.table} (${cols.join(', ')}) VALUES (${placeholders})`,
        Object.values(row)
      )
      return { success: true, insertId: result.insertId }

    } else if (schema.type === 'mongodb') {
      const collInfo = schema.fields.pages || schema.fields.posts
      if (!collInfo) return { success: false, error: 'No se encontro coleccion de paginas' }

      const doc = {
        createdAt: new Date(),
        updated_by: AGENT_TAG,
      }
      if (collInfo.detected.slug) doc[collInfo.detected.slug] = pageData.slug
      if (collInfo.detected.title) doc[collInfo.detected.title] = pageData.meta_title
      if (collInfo.detected.meta_description) doc[collInfo.detected.meta_description] = pageData.meta_description
      if (collInfo.detected.content_html) doc[collInfo.detected.content_html] = pageData.contenido_html
      if (collInfo.detected.schema_jsonld) doc[collInfo.detected.schema_jsonld] = pageData.schema_jsonld

      const result = await dbConnection.collection(collInfo.collection).insertOne(doc)
      return { success: true, insertedId: result.insertedId }
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Verificar si un slug ya existe
 */
async function slugExists(slug) {
  const schema = getSchema()
  if (!dbConnection || !schema) return false

  try {
    if (schema.type === 'mysql') {
      for (const [, info] of Object.entries(schema.columns)) {
        const slugCol = info.detected.slug
        if (!slugCol) continue
        const [rows] = await dbConnection.query(
          `SELECT 1 FROM ${info.table} WHERE ${slugCol} = ? LIMIT 1`,
          [slug]
        )
        if (rows.length > 0) return true
      }
    } else if (schema.type === 'mongodb') {
      for (const [, info] of Object.entries(schema.fields)) {
        const slugField = info.detected.slug
        if (!slugField) continue
        const doc = await dbConnection.collection(info.collection).findOne({ [slugField]: slug })
        if (doc) return true
      }
    }
  } catch { /* error */ }
  return false
}

/**
 * Obtener paginas actualizadas recientemente por el agente
 */
async function getRecentlyUpdatedPages(days = 7) {
  const schema = getSchema()
  if (!dbConnection || !schema) return []

  const pages = []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  try {
    if (schema.type === 'mysql') {
      for (const [, info] of Object.entries(schema.columns)) {
        const updatedCol = info.detected.updated_at
        const slugCol = info.detected.slug
        const updatedByCol = info.detected.updated_by
        if (!updatedCol || !slugCol) continue

        // Preferir filtrar por updated_by del agente
        let query = `SELECT ${slugCol} as slug FROM ${info.table} WHERE ${updatedCol} >= ?`
        const params = [since]
        if (updatedByCol) {
          query += ` AND ${updatedByCol} = ?`
          params.push(AGENT_TAG)
        }
        query += ` ORDER BY ${updatedCol} DESC LIMIT 100`

        const [rows] = await dbConnection.query(query, params)
        pages.push(...rows.map(r => r.slug))
      }
    } else if (schema.type === 'mongodb') {
      for (const [, info] of Object.entries(schema.fields)) {
        const updatedField = info.detected.updated_at
        const slugField = info.detected.slug
        if (!updatedField || !slugField) continue

        const filter = { [updatedField]: { $gte: since } }
        if (info.detected.updated_by) {
          filter[info.detected.updated_by] = AGENT_TAG
        }

        const docs = await dbConnection.collection(info.collection)
          .find(filter)
          .project({ [slugField]: 1 })
          .limit(100)
          .toArray()
        pages.push(...docs.map(d => d[slugField]))
      }
    }
  } catch { /* error */ }
  return pages
}

async function closeDB() {
  if (!dbConnection) return
  try {
    if (dbType === 'mysql') {
      await dbConnection.end()
    } else if (dbType === 'mongodb') {
      await dbConnection.client.close()
    }
  } catch { /* ya cerrada */ }
}

module.exports = {
  initDB,
  getSchema,
  updateMeta,
  insertPage,
  slugExists,
  getRecentlyUpdatedPages,
  closeDB,
}
