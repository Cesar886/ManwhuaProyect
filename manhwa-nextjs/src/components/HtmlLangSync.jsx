'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Sincroniza <html lang> en el cliente según el pathname.
 * El servidor siempre renderiza lang="es"; este componente lo corrige
 * a "en" en rutas /en/* inmediatamente tras la hidratación.
 */
export default function HtmlLangSync() {
  const pathname = usePathname()

  useEffect(() => {
    document.documentElement.lang = pathname.startsWith('/en') ? 'en' : 'es'
  }, [pathname])

  return null
}
