'use client'

import { Loader } from '@mantine/core'

export default function LoadingSpinner({ size = 'md', fullscreen = false }) {
  if (fullscreen) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--page-bg)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader size="xl" color="cyan" />
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
            Cargando...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '3rem',
    }}>
      <Loader size={size} color="cyan" />
    </div>
  )
}
