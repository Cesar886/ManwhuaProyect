import Link from 'next/link'
import AppLayout from '@/components/AppLayout'

export default function NotFound() {
  return (
    <AppLayout>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <div style={{
          fontSize: '8rem',
          marginBottom: '1rem',
          background: 'var(--gradient-text-imperial)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontWeight: 900,
        }}>
          404
        </div>

        <h1 style={{
          fontSize: '2.5rem',
          fontFamily: 'var(--font-heading)',
          marginBottom: '1rem',
        }}>
          Página no encontrada
        </h1>

        <p style={{
          fontSize: '1.2rem',
          color: 'var(--text-muted)',
          marginBottom: '2rem',
          maxWidth: '500px',
        }}>
          Lo sentimos, la página que buscas no existe o ha sido movida.
        </p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/home" className="btn-imperial" style={{ textDecoration: 'none' }}>
            Volver al Inicio
          </Link>
          <Link href="/biblioteca" className="btn-imperial-outline" style={{ textDecoration: 'none' }}>
            Biblioteca
          </Link>
        </div>
      </div>
    </AppLayout>
  )
}
