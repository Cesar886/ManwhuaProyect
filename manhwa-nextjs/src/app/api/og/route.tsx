import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'

// Node.js runtime — Prisma no funciona en edge
export const runtime = 'nodejs'

type ManhwaItem = {
  titulo: string
  portadaUrl: string
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')

  if (!id) {
    return new Response('Missing id', { status: 400 })
  }

  const resultado = await prisma.resultadoIA.findUnique({
    where: { id },
    select: { query: true, manhwas: true },
  })

  if (!resultado) {
    return new Response('Not found', { status: 404 })
  }

  const manhwas = (resultado.manhwas as ManhwaItem[]) ?? []
  const covers = manhwas.slice(0, 3)

  // Tamaño de cada portada según cuántas haya
  const coverW = covers.length === 1 ? 280 : covers.length === 2 ? 260 : 220
  const coverH = Math.round(coverW * 1.45)

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          backgroundColor: '#0f0f0f',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 60px 40px',
          position: 'relative',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Logo esquina superior derecha */}
        <div
          style={{
            position: 'absolute',
            top: '28px',
            right: '44px',
            color: '#a855f7',
            fontSize: '17px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#a855f7',
              display: 'flex',
            }}
          />
          IA Imperial
        </div>

        {/* Fila de portadas */}
        {covers.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '18px',
              marginBottom: '36px',
            }}
          >
            {covers.map((manhwa, i) => (
              <div
                key={i}
                style={{
                  width: `${coverW}px`,
                  height: `${coverH}px`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  // Sombra entre portadas (más intensa en los extremos)
                  boxShadow:
                    i === 0 || i === covers.length - 1
                      ? '0 12px 48px rgba(0,0,0,0.85)'
                      : '0 8px 28px rgba(0,0,0,0.6)',
                  display: 'flex',
                  // Atenuar portadas laterales ligeramente
                  opacity: covers.length === 3 && i !== 1 ? 0.88 : 1,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={manhwa.portadaUrl}
                  alt={manhwa.titulo}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Título = query del usuario */}
        <div
          style={{
            color: '#ffffff',
            fontSize: covers.length > 0 ? '34px' : '52px',
            fontWeight: 700,
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.22,
            marginBottom: '14px',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {resultado.query}
        </div>

        {/* Subtítulo */}
        <div
          style={{
            color: '#666666',
            fontSize: '19px',
            textAlign: 'center',
            display: 'flex',
            letterSpacing: '0.02em',
          }}
        >
          IA Imperial · manhwaimperial.site
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
