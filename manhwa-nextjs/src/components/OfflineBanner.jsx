'use client'

import { IconWifiOff } from '@tabler/icons-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Banner que aparece cuando el usuario pierde conexión.
 * Se monta en el layout principal (MainLayout o providers).
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
        color: '#fff',
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontSize: '0.9rem',
        fontWeight: 500,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.3)',
      }}
    >
      <IconWifiOff size={18} />
      Sin conexión a internet — algunas funciones pueden no estar disponibles
    </div>
  )
}
