'use client'

import dynamic from 'next/dynamic'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ImageOptimizationProvider } from '@/contexts/ImageOptimizationContext'

// LoginModal carga lazy: GoogleOAuthProvider (y el script de Google ~90 KiB)
// solo se descarga cuando el usuario abre el modal de login
const LoginModal = dynamic(() => import('@/components/LoginModal'), {
  ssr: false,
  loading: () => null
})

function AuthModals() {
  const { showLogin, closeLogin } = useAuth()

  if (!showLogin) return null

  return (
    <LoginModal
      opened={showLogin}
      onClose={closeLogin}
    />
  )
}

export function Providers({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ImageOptimizationProvider>
          {children}
          <AuthModals />
        </ImageOptimizationProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
