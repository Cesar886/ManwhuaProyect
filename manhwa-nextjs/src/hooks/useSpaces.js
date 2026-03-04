/**
 * useSpaces.js - Hook simple para carga de manhwas via REST
 * 
 * ARQUITECTURA HÍBRIDA - FASE 1: Carga Inicial
 * ============================================
 * - Carga rápida via REST (150-200ms)
 * - Cache HTTP automático del navegador (5 min)
 * - Simple, robusto, predecible
 * - Sin race conditions ni timeouts complejos
 * 
 * Usar junto con useSpacesUpdates para actualizaciones en tiempo real
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { endpoint } from '../config'
import logger from '../utils/logger'

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
  // Timeout para la petición REST (30 segundos - aumentado para servidores lentos)
  timeout: 30000,
  // TTL del cache en sessionStorage (5 minutos)
  sessionCacheTtl: 5 * 60 * 1000,
  // Key para sessionStorage
  // Reintentos en caso de error
  maxRetries: 2,
  // Delay entre reintentos (ms)
  retryDelay: 1000,
}



/**
 * Hook principal para cargar manhwas via REST
 * Simple, rápido, robusto
 */
export function useSpaces() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null) // 'cache' | 'api' | 'session'

  // Función de carga con reintentos (sin cache)
  const loadSpaces = useCallback(async (forceRefresh = false) => {
    let lastError = null
    for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.debug(`🔄 Reintento ${attempt}/${CONFIG.maxRetries}...`)
          await new Promise(r => setTimeout(r, CONFIG.retryDelay * attempt))
        }
        // Crear AbortController para timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout)
        const url = forceRefresh
          ? endpoint('spaces', 'manhwas?refresh=true')
          : endpoint('spaces', 'manhwas')
        
        logger.debug(`🌐 Intentando conectar...`)
        
        const response = await fetch(url, {
          signal: controller.signal,
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=300',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          }
        })
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Sin detalles del error')
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`)
        }
        const result = await response.json()

        const seriesData = result.data?.series || result.series || []

        // Si el servidor no devolvió ningún dato, reintentar una vez
        if (seriesData.length === 0 && attempt < CONFIG.maxRetries) {
          logger.debug('🔄 Sin datos del servidor, reintentando...')
          await new Promise(r => setTimeout(r, 3000))
          lastError = new Error('Sin datos disponibles')
          continue
        }

        return {
          data: seriesData,
          source: result.cached ? 'api-cache' : 'api-fresh',
          loadTime: result.loadTime
        }
      } catch (err) {
        lastError = err
        const isNetworkError = err.name === 'TypeError' && err.message.includes('fetch')
        const isTimeoutError = err.name === 'AbortError'
        
        logger.warn(`⚠️ Error en intento ${attempt + 1}/${CONFIG.maxRetries}:`, {
          message: err.message,
          name: err.name,
          isNetworkError,
          isTimeoutError,
          url: forceRefresh ? endpoint('spaces', 'manhwas?refresh=true') : endpoint('spaces', 'manhwas')
        })
        
        if (err.name === 'AbortError') {
          lastError = new Error(`Timeout: El servidor tardó más de ${CONFIG.timeout / 1000} segundos en responder`)
          break
        }
        
        // Si es un error de red y no estamos en el último intento, continuamos
        if (isNetworkError && attempt < CONFIG.maxRetries) {
          continue
        }
      }
    }
    
    // Mejorar el mensaje de error final según el tipo de error
    if (lastError?.name === 'TypeError' && lastError.message.includes('fetch')) {
      throw new Error('Error de conexión: No se pudo conectar al servidor. Verifica tu conexión a internet o que la API esté disponible.')
    } else if (lastError?.name === 'AbortError') {
      throw new Error(`Timeout: El servidor tardó más de ${CONFIG.timeout / 1000} segundos en responder`)
    }
    
    throw lastError
  }, [])

  // Efecto de carga inicial (sin cache)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const result = await loadSpaces()
        if (!cancelled) {
          setSeries(result.data)
          setSource(result.source)
          setError(null)
        }
      } catch (err) {
        const errorMsg = err.message || 'Error desconocido al cargar manhwas'
        const isNetworkError = err.name === 'TypeError' && err.message.includes('fetch')
        
        logger.error('❌ Error cargando manhwas:', {
          message: errorMsg,
          name: err.name,
          isNetworkError,
          stack: err.stack?.split('\n').slice(0, 3).join('\n'),
          endpoint: 'manhwas',
          timestamp: new Date().toISOString()
        })
        
        if (!cancelled) {
          // Mostrar mensaje más amigable al usuario
          if (isNetworkError || errorMsg.includes('NetworkError') || errorMsg.includes('conexión')) {
            setError('❌ Error de conexión: No se pudo conectar al servidor. Verifica tu conexión a internet.')
          } else if (errorMsg.includes('Timeout')) {
            setError('⏱️ Timeout: El servidor tardó demasiado en responder. Intenta de nuevo.')
          } else {
            setError(`❌ Error: ${errorMsg}`)
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }
    load()
    return () => { cancelled = true }
  }, [loadSpaces])

  // Función para refrescar manualmente
  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const result = await loadSpaces(true)
      setSeries(result.data)
      setSource('refresh')
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loadSpaces])

  // Limpiar cache (no hace nada)
  const clearCache = useCallback(() => {
    logger.debug('🗑️ Cache limpiado (noop)')
  }, [])

  return {
    // Datos
    series,
    loading,
    error,
    source,
    // Funciones
    refresh,
    clearCache,
    // Helpers
    isEmpty: !loading && series.length === 0,
    hasError: !!error,
    isFromCache: false,
  }
}

/**
 * Hook para obtener detalles de una serie específica
 * IMPORTANTE: Preserva los datos SSR iniciales para evitar Soft 404 en Google
 */
export function useSeriesDetail(slug, initialData = null) {
  const [series, setSeries] = useState(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)
  // Ref para controlar si ya se usó la data inicial
  const initialDataUsed = useRef(!!initialData)
  // Ref para preservar los datos SSR originales (nunca se pierden)
  const ssrDataRef = useRef(initialData)

  // Función para cargar los datos
  const load = useCallback(async (forceRefresh = false) => {
    if (!slug) return

    // Si tenemos data inicial y no es un refresh forzado, no cargamos nada
    // (Los datos SSR son frescos y confiables para SEO)
    if (initialDataUsed.current && !forceRefresh) {
      initialDataUsed.current = false
      return
    }

    try {
      setLoading(true)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout)

      // Agregar timestamp para evitar cache del navegador en refresh
      const url = forceRefresh
        ? `${endpoint('spaces', `manhwas/${slug}`)}?t=${Date.now()}`
        : endpoint('spaces', `manhwas/${slug}`)

      const response = await fetch(url, {
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Cache-Control': forceRefresh ? 'no-cache' : 'max-age=60',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        }
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(response.status === 404 ? 'Serie no encontrada' : `Error ${response.status}`)
      }

      const result = await response.json()

      setSeries(result.data)
      setError(null)

    } catch (err) {
      // IMPORTANTE: Si hay datos SSR, NO sobrescribimos series con null
      // Esto evita el Soft 404 en Google cuando el fetch del cliente falla
      if (!ssrDataRef.current) {
        setError(err.message)
      }
      logger.error('❌ Error cargando serie:', err.message)
    } finally {
      setLoading(false)
    }
  }, [slug])

  // Efecto para carga inicial y cuando cambia el slug
  useEffect(() => {
    load()
  }, [load, refetchTrigger])

  // Función para forzar recarga (sin caché)
  const refetch = useCallback(() => {
    logger.debug('🔄 Refetch solicitado para:', slug)
    setRefetchTrigger(prev => prev + 1)
    load(true)
  }, [load, slug])

  return { series, loading, error, refetch }
}

/**
 * Hook para obtener páginas de un capítulo
 */
export function useChapterPages(seriesSlug, chapterNum) {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!seriesSlug || !chapterNum) {
      setLoading(false)
      return
    }

    let cancelled = false
    // Limpiar páginas del capítulo anterior inmediatamente al cambiar
    setPages([])

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const paddedChapter = String(chapterNum).padStart(4, '0')
        const spacesUrl = process.env.NEXT_PUBLIC_DO_SPACES_URL
        const baseUrl = `${spacesUrl}/${seriesSlug}/cap-${paddedChapter}`

        // Fetch en paralelo: images.json (siempre existe) + images-meta.json (opcional, tiene blurhash)
        const [imagesResult, metaResult] = await Promise.allSettled([
          fetch(`${baseUrl}/images.json`).then(r => r.ok ? r.json() : Promise.reject()),
          fetch(`${baseUrl}/images-meta.json`).then(r => r.ok ? r.json() : Promise.reject()),
        ])

        let pagesData = null

        // Preferir images-meta.json si tiene datos (blurhash + dimensiones)
        if (
          metaResult.status === 'fulfilled' &&
          Array.isArray(metaResult.value) &&
          metaResult.value.length > 0
        ) {
          pagesData = metaResult.value.map((item, idx) => ({
            url: item.url,
            blurhash: item.blurhash || null,
            w: item.w || null,
            h: item.h || null,
            number: idx + 1,
          }))
        } else if (
          imagesResult.status === 'fulfilled' &&
          Array.isArray(imagesResult.value) &&
          imagesResult.value.length > 0
        ) {
          pagesData = imagesResult.value.map((url, idx) => ({
            url,
            number: idx + 1,
          }))
        }

        if (pagesData) {
          if (!cancelled) {
            setPages(pagesData)
            setError(null)
          }
        } else {
          // Si no existe images.json, mostrar error
          if (!cancelled) {
            setPages([])
            setError('No se encontró images.json para este capítulo.')
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    load()

    return () => { cancelled = true }
  }, [seriesSlug, chapterNum])

  return { pages, loading, error }
}

export default useSpaces
