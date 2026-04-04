'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import styles from './LanguageBanner.module.css'

export default function LanguageBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [suggestedLang, setSuggestedLang] = useState(null)
  const pathname = usePathname()

  useEffect(() => {
    // Verificar si ya se cerró el banner en esta sesión
    const dismissed = sessionStorage.getItem('lang-banner-dismissed')
    if (dismissed) return

    // Detectar el header del middleware
    // Nota: los headers del middleware no son accesibles directamente en el cliente
    // Alternativa: usar la lógica de detección de idioma en el cliente
    const browserLang = navigator.language || navigator.userLanguage
    const prefersEnglish = browserLang.startsWith('en') && !browserLang.startsWith('es')
    const prefersSpanish = browserLang.startsWith('es')

    // Usuario en ruta española pero prefiere inglés
    if (prefersEnglish && !pathname.startsWith('/en')) {
      setSuggestedLang('en')
      setShowBanner(true)
    }
    // Usuario en ruta inglesa pero prefiere español
    else if (prefersSpanish && pathname.startsWith('/en')) {
      setSuggestedLang('es')
      setShowBanner(true)
    }
  }, [pathname])

  const handleDismiss = () => {
    setShowBanner(false)
    sessionStorage.setItem('lang-banner-dismissed', 'true')
  }

  const handleSetPreference = (lang) => {
    // Guardar preferencia en cookie
    document.cookie = `preferred_lang=${lang}; path=/; max-age=31536000; SameSite=Lax`
    setShowBanner(false)
    sessionStorage.setItem('lang-banner-dismissed', 'true')
  }

  if (!showBanner || !suggestedLang) return null

  const getSwitchUrl = () => {
    if (suggestedLang === 'en') {
      // Convertir ruta española a inglesa
      if (pathname === '/' || pathname === '/home') return '/en/home'
      if (pathname.startsWith('/populares')) return '/en/populares'
      if (pathname.startsWith('/acerca-de')) return '/en/about'
      if (pathname.startsWith('/dmca')) return '/en/dmca'
      if (pathname.startsWith('/terminos')) return '/en/terms-of-service'
      if (pathname.startsWith('/politica')) return '/en/privacy-policy'
      if (pathname.startsWith('/biblioteca')) return '/en/library'
      return '/en/home'
    } else {
      // Convertir ruta inglesa a española
      return pathname.replace(/^\/en/, '') || '/home'
    }
  }

  const texts = {
    en: {
      message: 'Would you like to view this site in English?',
      switch: 'Switch to English',
      stay: 'Stay in Spanish',
    },
    es: {
      message: '¿Prefieres ver este sitio en español?',
      switch: 'Cambiar a español',
      stay: 'Stay in English',
    },
  }

  const t = texts[suggestedLang]
  const switchUrl = getSwitchUrl()

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <p className={styles.message}>
          {suggestedLang === 'en' ? '🇬🇧' : '🇪🇸'} {t.message}
        </p>
        <div className={styles.actions}>
          <Link
            href={switchUrl}
            className={styles.switchBtn}
            onClick={() => handleSetPreference(suggestedLang)}
          >
            {t.switch}
          </Link>
          <button
            className={styles.dismissBtn}
            onClick={handleDismiss}
            aria-label="Dismiss"
          >
            {t.stay}
          </button>
        </div>
      </div>
    </div>
  )
}
