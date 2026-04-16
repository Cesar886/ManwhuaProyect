import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { SITE_URL } from '@/config'

type ManhwaItem = {
  titulo: string
  portadaUrl: string
}

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params

  const resultado = await prisma.resultadoIA.findUnique({
    where: { id },
    select: { query: true },
  })

  if (!resultado) return {}

  const pageUrl = `${SITE_URL}/resultados/${id}`
  const ogImageUrl = `${SITE_URL}/api/og?id=${id}`

  return {
    title: `${resultado.query} - IA Imperial`,
    description: 'IA Imperial encontró estas recomendaciones para ti · manhwaimperial.site',
    alternates: { canonical: pageUrl },
    openGraph: {
      title: resultado.query,
      description: 'IA Imperial encontró estas recomendaciones para ti · manhwaimperial.site',
      url: pageUrl,
      siteName: 'Manhwa Imperial',
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: resultado.query,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: resultado.query,
      description: 'IA Imperial encontró estas recomendaciones para ti · manhwaimperial.site',
      images: [ogImageUrl],
    },
  }
}

export default async function ResultadosIAPage({ params }: Props) {
  const { id } = await params

  const resultado = await prisma.resultadoIA.findUnique({
    where: { id },
  })

  if (!resultado) notFound()

  const manhwas = (resultado.manhwas as ManhwaItem[]) ?? []

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--page-bg)',
        color: 'var(--text-color)',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <p style={{ color: '#a855f7', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
          IA Imperial
        </p>
        <h1
          style={{
            fontSize: 'clamp(1.4rem, 4vw, 2.2rem)',
            fontWeight: 700,
            marginBottom: '0.5rem',
            lineHeight: 1.25,
          }}
        >
          {resultado.query}
        </h1>
        <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '2.5rem' }}>
          IA Imperial encontró estas recomendaciones para ti
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {manhwas.map((manhwa, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  aspectRatio: '2/3',
                  background: '#1a1a1a',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={manhwa.portadaUrl}
                  alt={`Portada de ${manhwa.titulo}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading={i < 6 ? 'eager' : 'lazy'}
                />
              </div>
              <p
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  lineHeight: 1.3,
                  margin: 0,
                }}
              >
                {manhwa.titulo}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <Link
            href="/busqueda-ia"
            style={{
              color: '#a855f7',
              fontSize: '0.9rem',
              textDecoration: 'underline',
            }}
          >
            ← Hacer otra búsqueda IA
          </Link>
        </div>
      </div>
    </main>
  )
}
