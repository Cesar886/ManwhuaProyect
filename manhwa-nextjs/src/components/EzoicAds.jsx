'use client'

import { useEffect } from 'react'

export default function EzoicAds() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    // NO cargar scripts de Ezoic en desarrollo local
    const isDevelopment = process.env.NODE_ENV === 'development' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'

    if (isDevelopment) {
      return
    }

    const loadEzoicScripts = () => {
      // Initialize ezstandalone first
      window.ezstandalone = window.ezstandalone || {}
      window.ezstandalone.cmd = window.ezstandalone.cmd || []

      // Load scripts sequentially to avoid blocking
      // IMPORTANTE: Usar https:// explícitamente en vez de // para evitar problemas de CSP
      const scripts = [
        { src: 'https://cmp.gatekeeperconsent.com/min.js', attrs: { 'data-cfasync': 'false' } },
        { src: 'https://the.gatekeeperconsent.com/cmp.min.js', attrs: { 'data-cfasync': 'false' } },
        { src: 'https://www.ezojs.com/ezoic/sa.min.js', attrs: {} },
      ]

      scripts.forEach(({ src, attrs }) => {
        const script = document.createElement('script')
        script.src = src
        script.async = true
        // Silently handle blocked scripts (ad blockers)
        script.onerror = () => { }
        Object.entries(attrs).forEach(([k, v]) => script.setAttribute(k, v))
        document.body.appendChild(script)
      })
    }

    // Defer loading until after page is fully interactive (3s delay)
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(loadEzoicScripts, { timeout: 5000 })
      return () => cancelIdleCallback(id)
    } else {
      const timer = setTimeout(loadEzoicScripts, 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  return null
}