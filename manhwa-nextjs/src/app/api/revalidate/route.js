import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Invalida la ISR de Next.js para una o más rutas.
 *
 * Usado por IMPERIAL-AGENT-v3 (seo-pipeline) tras actualizar meta_title/meta_description
 * en la DB, para que la siguiente request regenere el HTML con los nuevos valores.
 *
 * Auth: secret en query (?secret=...) debe coincidir con REVALIDATE_SECRET.
 *
 * Body JSON (opcional):
 *   { slug: "mi-serie", numero?: "123", tags?: ["series"], paths?: ["/ruta/custom"] }
 *
 * Si se pasa slug: invalida /manhwa/<slug>, /en/manhwa/<slug>, y si numero está
 * presente también los capítulos en ambos idiomas.
 */
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')

  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body = {}
  try { body = await request.json() } catch { /* sin body */ }

  const revalidated = []
  const errors = []

  const revalidate = (p) => {
    try { revalidatePath(p); revalidated.push(p) } catch (e) { errors.push({ path: p, error: e.message }) }
  }

  if (body.slug) {
    const slug = String(body.slug).trim()
    if (slug) {
      revalidate(`/manhwa/${slug}`)
      revalidate(`/en/manhwa/${slug}`)
      if (body.numero !== undefined && body.numero !== null) {
        const n = String(body.numero).trim()
        if (n) {
          revalidate(`/manhwa/${slug}/capitulo/${n}`)
          revalidate(`/en/manhwa/${slug}/chapter/${n}`)
        }
      }
    }
  }

  if (Array.isArray(body.paths)) {
    for (const p of body.paths) {
      if (typeof p === 'string' && p.startsWith('/')) revalidate(p)
    }
  }

  if (Array.isArray(body.tags)) {
    for (const t of body.tags) {
      if (typeof t === 'string') {
        try { revalidateTag(t); revalidated.push(`tag:${t}`) } catch (e) { errors.push({ tag: t, error: e.message }) }
      }
    }
  }

  if (revalidated.length === 0 && errors.length === 0) {
    return Response.json({ error: 'No slug/paths/tags provided' }, { status: 400 })
  }

  return Response.json({
    success: errors.length === 0,
    revalidated,
    errors,
    ts: new Date().toISOString(),
  })
}

export async function GET() {
  return Response.json({
    uso: 'POST /api/revalidate?secret=... con body JSON { slug, numero?, paths?, tags? }',
    secretConfigurado: !!process.env.REVALIDATE_SECRET,
  })
}
