'use client'

/**
 * Global Error Boundary — última línea de defensa.
 * Captura errores en el root layout que error.jsx no puede atrapar.
 * DEBE re-declarar <html> y <body> porque el root layout ya no se renderiza.
 */
export default function GlobalError({ reset }) {
  return (
    <html lang="es">
      <body style={{
        margin: 0,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F0F14',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#E8E6E3',
      }}>
        <div style={{
          maxWidth: '480px',
          textAlign: 'center',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            Algo sali&oacute; mal
          </h1>
          <p style={{ color: '#9CA3AF', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Ocurri&oacute; un error inesperado. Si el problema persiste, intenta borrar la cach&eacute; del navegador.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #0066CC, #00A8E8)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reintentar
            </button>
            <a
              href="/home"
              style={{
                padding: '0.75rem 1.5rem',
                background: 'transparent',
                color: '#00A8E8',
                border: '1px solid #00A8E8',
                borderRadius: '8px',
                fontSize: '0.95rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
