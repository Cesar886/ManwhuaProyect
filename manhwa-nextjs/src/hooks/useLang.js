'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { getTranslations } from '@/i18n/translations'

/**
 * Hook para obtener el idioma actual basado en la ruta
 * @returns {Object} { lang: 'es'|'en', t: translations }
 */
export function useLang() {
  const pathname = usePathname()
  
  const lang = useMemo(() => {
    return pathname?.startsWith('/en') ? 'en' : 'es'
  }, [pathname])
  
  const t = useMemo(() => {
    return getTranslations(lang)
  }, [lang])
  
  return { lang, t }
}

/**
 * Hook simple que solo retorna el idioma
 */
export function useLanguage() {
  const pathname = usePathname()
  return pathname?.startsWith('/en') ? 'en' : 'es'
}
