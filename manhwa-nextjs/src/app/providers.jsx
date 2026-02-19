'use client'

import dynamic from 'next/dynamic'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastProvider } from '@/contexts/ToastContext'
import { ImageOptimizationProvider } from '@/contexts/ImageOptimizationContext'
import { GoogleOAuthProvider } from '@react-oauth/google'

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
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <ToastProvider>
          <ImageOptimizationProvider>
            {children}
            <AuthModals />
          </ImageOptimizationProvider>
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  )
}
