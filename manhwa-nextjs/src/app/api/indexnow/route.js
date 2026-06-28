import { endpoint, SITE_URL } from '@/config'

const INDEXNOW_KEY = 'f2cdd862b4624457846d2d3e59f308a8'
const INDEXNOW_API = 'https://api.indexnow.org/IndexNow'
const BATCH_SIZE = 10000
const API_KEY = process.env.INTERNAL_API_KEY || ''

const STATIC_PAGES = [
  '/',
  '/home',
  '/populares',
  '/colecciones',
  '/biblioteca',
  '/pedidos',
]

// Siempre obtiene datos frescos (sin caché de Next.js)
async function fetchFreshSeries() {
  const url = endpoint('spaces', 'manhwas')
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Accept': 'application/json',
      'Origin': SITE_URL,
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
    },
  })

  if (!res.ok) {
    throw new Error(`Error al obtener series: HTTP ${res.status}`)
  }

  const result = await res.json()
  const series = result.data?.series || result.series || result.data || []
  return Array.isArray(series) ? series.filter(s => s.slug) : []
}

async function submitBatch(urls) {
  const res = await fetch(INDEXNOW_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(SITE_URL).hostname,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  })
  return res.status
}

export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.INDEXNOW_SECRET || secret !== process.env.INDEXNOW_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = searchParams.get('mode') || 'all'
  const RECENT_DAYS = 14
  const recentCutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000

  const staticUrls = STATIC_PAGES.map(p => `${SITE_URL}${p}`)
  let seriesUrls = []
  let chapterUrls = []

  try {
    if (mode !== 'static') {
      const series = await fetchFreshSeries()

      seriesUrls = series.map(s => `${SITE_URL}/manhwa/${s.slug}`)

      if (mode !== 'series') {
        const sorted = series
          .filter(s => (s.chapterCount || 0) > 0)
          .sort((a, b) => {
            const aTime = new Date(a.lastUpdated || a.updatedAt || 0).getTime()
            const bTime = new Date(b.lastUpdated || b.updatedAt || 0).getTime()
            return bTime - aTime
          })

        for (const serie of sorted) {
          const count = serie.chapterCount
          const lastMod = serie.lastUpdated || serie.updatedAt || null
          const isRecent = new Date(lastMod || 0).getTime() >= recentCutoff

          if (mode === 'recent' && !isRecent) continue

          for (let n = count; n >= 1; n--) {
            // En modo 'recent' solo enviamos el último capítulo de cada serie
            if (mode === 'recent' && n !== count) continue
            chapterUrls.push(`${SITE_URL}/manhwa/${serie.slug}/capitulo/${n}`)
          }
        }
      }
    }
  } catch (err) {
    return Response.json(
      { error: `Error obteniendo datos: ${err.message}` },
      { status: 502 }
    )
  }

  const allUrls = [...staticUrls, ...seriesUrls, ...chapterUrls]

  if (allUrls.length === 0) {
    return Response.json({ error: 'No se encontraron URLs para enviar' }, { status: 400 })
  }

  const results = []
  for (let i = 0; i < allUrls.length; i += BATCH_SIZE) {
    const batch = allUrls.slice(i, i + BATCH_SIZE)
    const status = await submitBatch(batch)
    results.push({
      lote: Math.floor(i / BATCH_SIZE) + 1,
      urls: batch.length,
      httpStatus: status,
      ok: status === 200 || status === 202,
    })
  }

  const totalIndexadas = results.filter(r => r.ok).reduce((sum, r) => sum + r.urls, 0)

  return Response.json({
    success: results.every(r => r.ok),
    mode,
    totalUrls: allUrls.length,
    totalIndexadas,
    desglose: {
      estaticas: staticUrls.length,
      series: seriesUrls.length,
      capitulos: chapterUrls.length,
    },
    lotes: results,
  })
}

export async function GET() {
  const secret = process.env.INDEXNOW_SECRET
  return Response.json({
    keyFile: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    secretConfigurado: !!secret && secret !== 'cambia_esto_por_un_secreto_seguro',
    uso: {
      all:    `POST /api/indexnow?secret=${secret}&mode=all`,
      recent: `POST /api/indexnow?secret=${secret}&mode=recent`,
      series: `POST /api/indexnow?secret=${secret}&mode=series`,
      static: `POST /api/indexnow?secret=${secret}&mode=static`,
    },
    descripcion: {
      all:    'Estáticas + todas las series + todos los capítulos',
      recent: 'Solo el último capítulo de series actualizadas en 14 días',
      series: 'Estáticas + páginas de series (sin capítulos)',
      static: 'Solo las 6 páginas estáticas',
    },
  })
}
