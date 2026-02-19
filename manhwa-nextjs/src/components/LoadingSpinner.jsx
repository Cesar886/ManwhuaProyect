'use client'

import { Loader } from '@mantine/core'

export default function LoadingSpinner({ size = 'md', fullscreen = false }) {
  if (fullscreen) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--page-bg)',
        zIndex: 9999,
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
