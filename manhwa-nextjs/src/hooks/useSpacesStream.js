import { useState, useEffect, useRef, useCallback } from 'react'
import { endpoint } from '../config'
import logger from '../utils/logger'

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
const apiKeyHeader = API_KEY ? { 'x-api-key': API_KEY } : {}

// ============================================
// CONFIGURACIÓN OPTIMIZADA V2
// Timeouts más cortos, mejor sincronización con backend
// ============================================
const isDev = process.env.NODE_ENV === 'development'

const SSE_CONFIG = {
  // Timeout para recibir datos SSE (reducido: el backend ahora responde rápido)
  initialTimeout: isDev ? 15000 : 10000,
  // Timeout de conexión: tiempo para establecer conexión SSE
  connectionTimeout: isDev ? 8000 : 5000,
  // Máximo de reintentos SSE antes de usar fallback permanente
  maxReconnectAttempts: 3,
  // Máximo de reintentos totales antes de mostrar error
  maxTotalAttempts: 5,
  // Delay máximo entre reintentos (10 segundos)
  maxReconnectDelay: 10000,
  // Delay base para backoff exponencial (1 segundo)
  baseReconnectDelay: 1000,
  // Tiempo mínimo entre intentos de conexión (anti-spam)
  connectionDebounce: 200,
  // Timeout para API fallback (más generoso que SSE)
  apiFallbackTimeout: 30000,
  // Cache en sessionStorage (evitar recargas innecesarias)
  useSessionCache: true,
  // TTL del cache de sesión: 5 minutos
  sessionCacheTtl: 300000,
}

// Key para sessionStorage
const SESSION_CACHE_KEY = 'manhwas_cache'

/**
 * Obtiene datos del cache de sesión si están disponibles y válidos
 */
const getSessionCache = () => {
  if (!SSE_CONFIG.useSessionCache) return null
  
  try {
    const cached = sessionStorage.getItem(SESSION_CACHE_KEY)
    if (!cached) return null
    
    const { data, timestamp } = JSON.parse(cached)
    const age = Date.now() - timestamp
    
    if (age < SSE_CONFIG.sessionCacheTtl && data?.length > 0) {
      logger.debug(`📦 SessionCache: Hit (age: ${Math.round(age/1000)}s, ${data.length} series)`)
      return data
    }
    
    // Cache expirado, limpiar
    sessionStorage.removeItem(SESSION_CACHE_KEY)
    return null
  } catch (e) {
    console.warn('⚠️ Error leyendo sessionStorage:', e.message)
    return null
  }
}

/**
 * Guarda datos en cache de sesión
 */
const setSessionCache = (data) => {
  if (!SSE_CONFIG.useSessionCache || !data?.length) return
  
    try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }))
    logger.debug(`💾 SessionCache: Guardado (${data.length} series)`)
  } catch (e) {
    logger.warn('⚠️ Error escribiendo sessionStorage:', e.message)
  }
}

/**
 * Hook para conectarse al stream SSE de Spaces
 * OPTIMIZADO V2: Mejor manejo de timeouts, cache de sesión, fallbacks robustos
 */
export function useSpacesStream() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connected, setConnected] = useState(false)
  // Estados adicionales para feedback de UI mejorado
  const [loadingMessage, setLoadingMessage] = useState('Conectando...')
  const [loadingPhase, setLoadingPhase] = useState('init') // init, sse, api, done, error
  const [isUsingFallback, setIsUsingFallback] = useState(false)
  
  const eventSourceRef = useRef(null)
  const reconnectTimeoutRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const totalAttempts = useRef(0)
  const initialLoadTimeoutRef = useRef(null)
  const connectionTimeoutRef = useRef(null)
  const lastConnectionAttempt = useRef(0)
  const isConnecting = useRef(false)
  const hasReceivedData = useRef(false)
  
  // Refs para funciones (evitar dependencias circulares)
  const loadViaApiRef = useRef(null)
  const handleConnectionFailureRef = useRef(null)
  const connectRef = useRef(null)

  // Función para cargar datos via API tradicional (fallback robusto)
  const loadViaApi = useCallback(async () => {
    try {
      logger.debug('📡 Cargando via API REST...')
      setLoading(true)
      setLoadingPhase('api')
      setLoadingMessage('Cargando desde API...')
      setIsUsingFallback(true)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), SSE_CONFIG.apiFallbackTimeout)
      
      const response = await fetch(endpoint('spaces', 'manhwas'), {
        credentials: 'include',
        signal: controller.signal,
        headers: { ...apiKeyHeader }
      })
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      const seriesData = data.data?.series || []
      
      logger.info(`✅ API: Cargados ${seriesData.length} manhwas (source: ${data.source || 'api'})`)
      
      setSeries(seriesData)
      setSessionCache(seriesData) // Guardar en cache de sesión
      setError(null)
      setLoadingPhase('done')
      hasReceivedData.current = true
      
    } catch (e) {
      logger.error('❌ Error cargando via API:', e.message)
      setLoadingPhase('error')
      
      // Intentar usar cache de sesión como último recurso
      const cachedData = getSessionCache()
      if (cachedData && cachedData.length > 0) {
        logger.debug('📦 Usando cache de sesión como fallback')
        setSeries(cachedData)
        setError(null)
        setLoadingMessage('Datos de caché (pueden estar desactualizados)')
        return
      }
      
      // Solo mostrar error si no tenemos datos
      setSeries(prev => {
        if (prev.length === 0) {
          setError('Error cargando manhwas. Comprueba tu conexión.')
        }
        return prev
      })
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }, [])
  
  // Actualizar ref
  loadViaApiRef.current = loadViaApi

  const connect = useCallback(() => {
    // Si ya hay una conexión activa y funcionando, no reconectar
    if (eventSourceRef.current && eventSourceRef.current.readyState === EventSource.OPEN) {
      logger.debug('⏭️ SSE: Ya hay conexión activa')
      return
    }
    
    // Prevenir conexiones duplicadas muy cercanas
    const now = Date.now()
    if (isConnecting.current && (now - lastConnectionAttempt.current) < SSE_CONFIG.connectionDebounce) {
      logger.debug('⏭️ SSE: Conexión en progreso, ignorando')
      return
    }
    
    isConnecting.current = true
    lastConnectionAttempt.current = now
    
    // Limpiar conexión anterior si existe
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    // Limpiar timeouts anteriores
    if (initialLoadTimeoutRef.current) {
      clearTimeout(initialLoadTimeoutRef.current)
    }
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }

    try {
      const streamUrl = endpoint('spaces', 'stream')
      totalAttempts.current++
      logger.debug(`🔌 SSE: Intentando conexión (intento ${totalAttempts.current})...`)
      setLoadingPhase('sse')
      
      const eventSource = new EventSource(streamUrl, { withCredentials: true })
      eventSourceRef.current = eventSource

      // Timeout de conexión: si no recibe 'connected' en X segundos
      connectionTimeoutRef.current = setTimeout(() => {
        if (eventSource.readyState !== EventSource.OPEN) {
          logger.warn('⏱️ SSE: Timeout de conexión')
          eventSource.close()
          isConnecting.current = false
          handleConnectionFailureRef.current?.()
        }
      }, SSE_CONFIG.connectionTimeout)

      // Timeout de datos iniciales: si no recibe 'initial' en X segundos
      initialLoadTimeoutRef.current = setTimeout(() => {
        if (!hasReceivedData.current && series.length === 0) {
          logger.warn('⏱️ SSE: Timeout esperando datos iniciales, usando API fallback')
          eventSource.close()
          setConnected(false)
          isConnecting.current = false
          loadViaApiRef.current?.()
        }
      }, SSE_CONFIG.initialTimeout)

      // Evento: conexión establecida
      eventSource.addEventListener('connected', () => {
        logger.debug('🔗 SSE: Conectado al stream de Spaces ✅')
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current)
        }
        setConnected(true)
        setError(null)
        setLoadingMessage('Cargando manhwas...')
        reconnectAttempts.current = 0
        isConnecting.current = false
      })

      // Evento: estado de carga (feedback del backend)
      eventSource.addEventListener('loading', (event) => {
        try {
          const data = JSON.parse(event.data)
          setLoadingMessage(data.message || 'Cargando...')
          logger.debug(`⏳ SSE: ${data.message}`)
        } catch {
          // Ignorar errores de parsing
        }
      })

      // Evento: datos iniciales
      eventSource.addEventListener('initial', (event) => {
        try {
          if (initialLoadTimeoutRef.current) {
            clearTimeout(initialLoadTimeoutRef.current)
            initialLoadTimeoutRef.current = null
          }
          const data = JSON.parse(event.data)
          const seriesData = data.series || []
          
          logger.debug(`📦 SSE: Recibidos ${seriesData.length} manhwas (source: ${data.source || 'unknown'}, time: ${data.loadTime}ms)`)
          
          setSeries(seriesData)
          setSessionCache(seriesData) // Guardar en cache de sesión
          setLoading(false)
          setLoadingMessage('')
          setLoadingPhase('done')
          setIsUsingFallback(false)
          hasReceivedData.current = true
          
        } catch (e) {
          logger.error('❌ Error parseando datos iniciales:', e)
          loadViaApiRef.current?.()
        }
      })

      // Evento: error del servidor (con info de fallback)
      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse(event.data)
          logger.warn('⚠️ SSE: Error del servidor:', data.message)
          
          if (data.useApiFallback) {
            logger.debug('📡 SSE: Backend sugiere usar API fallback')
            loadViaApiRef.current?.()
          }
        } catch {
          // Error sin datos, manejar como error de conexión
          if (eventSource.readyState === EventSource.CLOSED) {
            console.warn('⚠️ SSE: Conexión cerrada')
          } else {
            console.warn('⚠️ SSE: Error en stream')
          }
          handleConnectionFailureRef.current?.()
        }
      })

      // Evento: nuevo capítulo
      eventSource.addEventListener('new_chapter', (event) => {
        try {
          const payload = JSON.parse(event.data)
          logger.debug('📚 Nuevo capítulo:', payload.series, payload.chapter)
          if (payload.data?.series) {
            setSeries(payload.data.series)
            setSessionCache(payload.data.series)
          }
        } catch (e) {
          logger.error('Error parseando nuevo capítulo:', e)
        }
      })

      // Evento: nueva serie
      eventSource.addEventListener('new_series', (event) => {
        try {
          const payload = JSON.parse(event.data)
          logger.debug('📖 Nueva serie:', payload.series)
          if (payload.data?.series) {
            setSeries(payload.data.series)
            setSessionCache(payload.data.series)
          }
        } catch (e) {
          logger.error('Error parseando nueva serie:', e)
        }
      })

      // Evento: heartbeat (mantener conexión viva)
      eventSource.addEventListener('heartbeat', () => {
        // La conexión sigue viva, no hacer nada visible
      })

      // Error nativo de EventSource
      eventSource.onerror = () => {
        isConnecting.current = false
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSource.close()
          // Solo reconectar si no hemos recibido datos aún
          if (!hasReceivedData.current) {
            handleConnectionFailureRef.current?.()
          }
        }
      }

    } catch (e) {
      logger.error('❌ Error creando EventSource:', e)
      isConnecting.current = false
      setError('Error conectando al servidor')
      setLoading(false)
      setLoadingPhase('error')
      loadViaApiRef.current?.()
    }
  }, [series.length])

  // Manejo centralizado de fallos de conexión (mejorado con exponential backoff)
  const handleConnectionFailure = useCallback(() => {
    setConnected(false)
    
    // Limpiar timeouts
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current)
    }
    
    // Determinar si reintentar SSE o usar fallback
    if (reconnectAttempts.current < SSE_CONFIG.maxReconnectAttempts) {
      // Backoff exponencial con jitter
      const baseDelay = SSE_CONFIG.baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
      const jitter = Math.random() * 500
      const delay = Math.min(baseDelay + jitter, SSE_CONFIG.maxReconnectDelay)
      
      logger.debug(`🔄 SSE: Reintentando en ${Math.round(delay)}ms (intento ${reconnectAttempts.current + 1}/${SSE_CONFIG.maxReconnectAttempts})`)
      setLoadingMessage(`Reconectando en ${Math.ceil(delay / 1000)}s...`)
      
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttempts.current++
        isConnecting.current = false
        connectRef.current?.()
      }, delay)
    } else if (totalAttempts.current < SSE_CONFIG.maxTotalAttempts) {
      // Usar API fallback
      logger.warn('📡 SSE: Máximo de reintentos SSE, usando API fallback')
      setLoadingPhase('api')
      loadViaApiRef.current?.()
    } else {
      // Demasiados intentos fallidos
      logger.error('❌ SSE: Demasiados intentos fallidos')
      setError('No se pudo conectar al servidor. Recarga la página para reintentar.')
      setLoading(false)
      setLoadingPhase('error')
      
      // Intentar API como último recurso
      loadViaApiRef.current?.()
    }
  }, [])
  
  // Actualizar refs después de definir las funciones
  connectRef.current = connect
  handleConnectionFailureRef.current = handleConnectionFailure

  // Refrescar datos manualmente
  const refresh = useCallback(async () => {
    try {
      setLoadingMessage('Actualizando...')
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), SSE_CONFIG.apiFallbackTimeout)
      
      const response = await fetch(endpoint('spaces', 'manhwas?refresh=true'), {
        credentials: 'include',
        signal: controller.signal,
        headers: { ...apiKeyHeader }
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        const data = await response.json()
        const seriesData = data.data?.series || []
        setSeries(seriesData)
        setSessionCache(seriesData)
        logger.debug('🔄 Datos actualizados')
      }
    } catch (e) {
      console.error('❌ Error refrescando:', e.message)
    } finally {
      setLoadingMessage('')
    }
  }, [])

  // Efecto de inicialización con cache de sesión
  useEffect(() => {
    // Resetear flags al montar
    isConnecting.current = false
    hasReceivedData.current = false
    
    // PASO 1: Intentar cargar desde cache de sesión (instantáneo)
    const cachedData = getSessionCache()
    if (cachedData && cachedData.length > 0) {
      logger.debug('📦 Cargando desde cache de sesión...')
      setSeries(cachedData)
      setLoading(false)
      setLoadingPhase('done')
      setLoadingMessage('')
      hasReceivedData.current = true
      
      // Aún conectar SSE para actualizaciones en tiempo real
      if (typeof EventSource !== 'undefined') {
        // Pequeño delay para no saturar
        setTimeout(() => connectRef.current?.(), 500)
      }
      return
    }
    
    // PASO 2: Sin cache, conectar SSE
    if (typeof EventSource !== 'undefined') {
      connectRef.current?.()
    } else {
      // Navegador no soporta SSE
      logger.warn('⚠️ Navegador no soporta SSE, usando API')
      loadViaApiRef.current?.()
    }

    return () => {
      // Limpiar todo al desmontar
      isConnecting.current = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (initialLoadTimeoutRef.current) {
        clearTimeout(initialLoadTimeoutRef.current)
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current)
      }
    }
  }, [])

  return {
    series,
    loading,
    error,
    connected,
    refresh,
    // Estados adicionales para feedback de UI mejorado
    loadingMessage,
    loadingPhase,
    isUsingFallback,
    // Funciones de control
    retryConnection: connect,
    // Función para limpiar cache de sesión (útil para debugging)
    clearSessionCache: () => {
      sessionStorage.removeItem(SESSION_CACHE_KEY)
      logger.debug('🗑️ Cache de sesión limpiado')
    }
  }
}

/**
 * Hook para obtener detalles de una serie específica desde Spaces
 */
export function useSpacesSeries(slug) {
  const [series, setSeries] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!slug) return

    const fetchSeries = async () => {
      let timeoutId
      const controller = new AbortController()
      try {
        setLoading(true)
        // Timeout aplicado ANTES de iniciar el fetch
        timeoutId = setTimeout(() => controller.abort(), SSE_CONFIG.apiFallbackTimeout)

        const response = await fetch(endpoint('spaces', `manhwas/${slug}`), {
          credentials: 'include',
          signal: controller.signal,
          headers: { ...apiKeyHeader }
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error('Serie no encontrada')
        }

        const data = await response.json()
        setSeries(data.data)
        setError(null)
      } catch (e) {
        console.error('Error cargando serie:', e)
        setError(e.message)
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    fetchSeries()
  }, [slug])

  return { series, loading, error }
}

/**
 * Hook para obtener páginas de un capítulo desde Spaces
 */
export function useSpacesChapter(seriesSlug, chapterNum) {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!seriesSlug || !chapterNum) return

    const fetchPages = async () => {
      let timeoutId
      const controller = new AbortController()
      try {
        setLoading(true)
        // Timeout aplicado ANTES de iniciar el fetch
        timeoutId = setTimeout(() => controller.abort(), SSE_CONFIG.apiFallbackTimeout)

        const response = await fetch(
          endpoint('spaces', `manhwas/${seriesSlug}/capitulo/${chapterNum}/pages`),
          { credentials: 'include', signal: controller.signal, headers: { ...apiKeyHeader } }
        )

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error('Capítulo no encontrado')
        }

        const data = await response.json()
        setPages(data.data?.pages || [])
        setError(null)
      } catch (e) {
        console.error('Error cargando capítulo:', e)
        setError(e.message)
      } finally {
        if (timeoutId) clearTimeout(timeoutId)
        setLoading(false)
      }
    }

    fetchPages()
  }, [seriesSlug, chapterNum])

  return { pages, loading, error }
}

export default useSpacesStream
