'use client'

import { Suspense } from 'react'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Center, Loader, Text, Stack } from '@mantine/core'
import { IconAlertCircle, IconBrandDiscord } from '@tabler/icons-react'

function DiscordCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { doDiscordLogin } = useAuth()
  const [error, setError] = useState(null)
  const hasAttemptedLogin = useRef(false)

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (hasAttemptedLogin.current) return

    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle Discord OAuth errors
    if (errorParam) {
      let errorMsg = 'Error de autorizacion de Discord'
      if (errorParam === 'access_denied') {
        errorMsg = 'Acceso denegado. Cancelaste la autorizacion.'
      } else if (errorDescription) {
        errorMsg = errorDescription
      }
      setError(errorMsg)
      setTimeout(() => router.push('/'), 3000)
      return
    }

    if (!code) {
      setError('No se recibio el codigo de autorizacion de Discord')
      setTimeout(() => router.push('/'), 3000)
      return
    }

    // Mark as attempted before making the request
    hasAttemptedLogin.current = true

    const handleDiscordLogin = async () => {
      try {
        await doDiscordLogin(code)
        // Small delay to show success before redirect
        setTimeout(() => router.push('/'), 500)
      } catch (err) {
        console.error('Discord login error:', err)
        const errorMsg = err?.message || err?.body?.message || 'Error al iniciar sesion con Discord'
        setError(errorMsg)
        setTimeout(() => router.push('/'), 3000)
      }
    }

    handleDiscordLogin()
  }, [searchParams, doDiscordLogin, router])

  if (error) {
    return (
      <Center style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0a0a)' }}>
        <Stack align="center" gap="md" style={{ padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
          <IconAlertCircle size={48} color="var(--mantine-color-red-6)" />
          <Text c="red" size="lg" fw={500}>{error}</Text>
          <Text c="dimmed" size="sm">Redirigiendo al inicio...</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Center style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0a0a)' }}>
      <Stack align="center" gap="lg" style={{ padding: '2rem' }}>
        <div style={{ position: 'relative' }}>
          <IconBrandDiscord size={64} color="#5865F2" />
          <Loader
            size="sm"
            color="#5865F2"
            style={{ position: 'absolute', bottom: -8, right: -8 }}
          />
        </div>
        <Text c="dimmed" size="lg">Iniciando sesion con Discord...</Text>
        <Text c="dimmed" size="xs">Por favor espera un momento</Text>
      </Stack>
    </Center>
  )
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <Center style={{ minHeight: '100vh', background: 'var(--bg-primary, #0a0a0a)' }}>
      <Stack align="center" gap="md">
        <Loader size="lg" color="#5865F2" />
        <Text c="dimmed">Cargando...</Text>
      </Stack>
    </Center>
  )
}

// Main page component with Suspense boundary (required for useSearchParams in Next.js 15)
export default function DiscordCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DiscordCallbackContent />
    </Suspense>
  )
}
