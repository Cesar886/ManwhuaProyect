import { SITE_URL } from '@/config'
import { fetchAllSeriesForSitemap } from '@/lib/seo/fetchSeries'
import { fetchAllChaptersFromSpaces } from '@/lib/seo/fetchChaptersFromSpaces'

const INDEXNOW_KEY = 'f2cdd862b4624457846d2d3e59f308a8'
const INDEXNOW_API = 'https://api.indexnow.org/IndexNow'
const BATCH_SIZE = 10000

const STATIC_PAGES = [
  '/',
  '/home',
  '/populares',
  '/colecciones',
  '/biblioteca',
  '/pedidos',
]

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
  // Protección: requiere INDEXNOW_SECRET en variables de entorno
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.INDEXNOW_SECRET || secret !== process.env.INDEXNOW_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = searchParams.get('mode') || 'all' // 'all' | 'recent' | 'static'

  // Páginas estáticas
  const staticUrls = STATIC_PAGES.map(p => `${SITE_URL}${p}`)

  let seriesUrls = []
  let chapterUrls = []

  if (mode !== 'static') {
    // Páginas de series
    const series = await fetchAllSeriesForSitemap()
    seriesUrls = series.map(s => `${SITE_URL}/manhwa/${s.slug}`)

    if (mode !== 'series') {
      // Páginas de capítulos
      const { allChapters } = await fetchAllChaptersFromSpaces()

      const chaptersToSubmit = mode === 'recent'
        // Solo capítulos de series actualizadas recientemente (isLatest o isRecent)
        ? allChapters.filter(ch => ch.isLatest || ch.isRecent)
        : allChapters

      chapterUrls = chaptersToSubmit.map(
        ch => `${SITE_URL}/manhwa/${ch.seriesSlug}/capitulo/${ch.chapterNumber}`
      )
    }
  }

  const allUrls = [...staticUrls, ...seriesUrls, ...chapterUrls]

  if (allUrls.length === 0) {
    return Response.json({ error: 'No se encontraron URLs para enviar' }, { status: 400 })
  }

  // Enviar en lotes de máximo 10.000 URLs (límite de IndexNow)
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

  const totalOk = results.filter(r => r.ok).reduce((sum, r) => sum + r.urls, 0)

  return Response.json({
    success: results.every(r => r.ok),
    totalUrls: allUrls.length,
    totalIndexadas: totalOk,
    desglose: {
      estaticas: staticUrls.length,
      series: seriesUrls.length,
      capitulos: chapterUrls.length,
    },
    lotes: results,
  })
}

// GET: información sobre el estado del setup
export async function GET() {
  return Response.json({
    keyFile: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    endpoint: `POST /api/indexnow?secret=TU_SECRET`,
    modos: {
      all: 'Envía todas las páginas (estáticas + series + capítulos)',
      recent: 'Envía solo capítulos de series actualizadas recientemente',
      series: 'Envía solo páginas estáticas y de series (sin capítulos)',
      static: 'Envía solo páginas estáticas',
    },
    configuracion: {
      INDEXNOW_SECRET: process.env.INDEXNOW_SECRET ? 'configurado' : 'FALTA - añadir al .env',
    },
  })
}
