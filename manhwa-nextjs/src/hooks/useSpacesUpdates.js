/**
 * useSpacesUpdates.js - Hook para actualizaciones en tiempo real via SSE
 * 
 * ARQUITECTURA HÍBRIDA - FASE 2: Actualizaciones en Tiempo Real
 * =============================================================
 * - Solo envía cuando HAY cambios reales
 * - No bloquea la carga inicial (usar con useSpaces)
 * - Falla gracefully (REST sigue funcionando)
 * - Ideal para notificaciones de nuevos capítulos
 * 
 * Uso:
 *   const { series } = useSpaces()                    // Carga inicial
 *   const { hasUpdates, newItems } = useSpacesUpdates(series)  // Actualizaciones
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { endpoint } from '../config'
import logger from '../utils/logger'

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
  // Intervalo de heartbeat esperado del servidor (30s)
  heartbeatInterval: 30000,
  // Timeout para detectar conexión muerta (45s sin heartbeat)
  connectionTimeout: 45000,
  // Máximo de reintentos antes de desactivar SSE
  maxReconnectAttempts: 3,
  // Delay entre reintentos (exponential backoff)
  baseReconnectDelay: 2000,
  // No intentar SSE hasta que haya datos iniciales
  requireInitialData: true,
}

/**
 * Hook para recibir actualizaciones en tiempo real via SSE
 * 
 * @param {Array} initialSeries - Series cargadas inicialmente via REST
 * @param {Object} options - Opciones de configuración
 * @returns {Object} Estado de actualizaciones
 */
export function useSpacesUpdates(initialSeries = [], options = {}) {
  const {
    enabled = true,           // Habilitar SSE
    onNewChapter = null,      // Callback cuando hay nuevo capítulo
    onNewSeries = null,       // Callback cuando hay nueva serie
    onUpdate = null,          // Callback genérico de actualización
    showNotifications = true  // Mostrar notificaciones del navegador
  } = options

  // Estado
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [newItems, setNewItems] = useState([])  // Items nuevos pendientes de ver
  const [updatedSeries, setUpdatedSeries] = useState(initialSeries)

  // Refs
  const eventSourceRef = useRef(null)
  const reconnectAttempts = useRef(0)
  const lastHeartbeat = useRef(null)
  const heartbeatCheckInterval = useRef(null)
  const connectRef = useRef(null)

  // Inicializar lastHeartbeat en el primer render
  useEffect(() => {
    lastHeartbeat.current = Date.now()
  }, [])

  // Computed: preferir actualizaciones locales (SSE) si existen,
  // en caso contrario usar las `initialSeries` (evita setState en effects)
  const computedSeries = (updatedSeries && updatedSeries.length > 0)
    ? updatedSeries
    : initialSeries

  // Mostrar notificación del navegador
  const showBrowserNotification = useCallback((title, body) => {
    if (!showNotifications) return

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.png' })
    }
  }, [showNotifications])

  // Manejar nuevo capítulo
  const handleNewChapter = useCallback((data) => {
    logger.debug('📚 Nuevo capítulo:', data.seriesTitle, data.chapterNumber)

    setLastUpdate({ type: 'new_chapter', data, timestamp: Date.now() })
    setNewItems(prev => [...prev, { type: 'chapter', ...data }])

    // Actualizar lista de series
    if (data.series) {
      setUpdatedSeries(data.series)
    }

    // Callbacks
    onNewChapter?.(data)
    onUpdate?.({ type: 'new_chapter', data })

    // Notificación
    showBrowserNotification(
      '📚 Nuevo Capítulo',
      `${data.seriesTitle} - Capítulo ${data.chapterNumber}`
    )
  }, [onNewChapter, onUpdate, showBrowserNotification])

  // Manejar nueva serie
  const handleNewSeries = useCallback((data) => {
    logger.debug('📖 Nueva serie:', data.title)

    setLastUpdate({ type: 'new_series', data, timestamp: Date.now() })
    setNewItems(prev => [...prev, { type: 'series', ...data }])

    // Actualizar lista
    if (data.series) {
      setUpdatedSeries(data.series)
    }

    // Callbacks
    onNewSeries?.(data)
    onUpdate?.({ type: 'new_series', data })

    // Notificación
    showBrowserNotification(
      '📖 Nueva Serie',
      data.title
    )
  }, [onNewSeries, onUpdate, showBrowserNotification])

  // Conectar a SSE
  const connect = useCallback(() => {
    // No conectar si está deshabilitado o no hay datos iniciales
    if (!enabled) return
    if (CONFIG.requireInitialData && initialSeries.length === 0) {
      logger.debug('⏳ SSE: Esperando datos iniciales...')
      return
    }

    // Limpiar conexión anterior
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      logger.debug('🔌 SSE Updates: Conectando...')
      const eventSource = new EventSource(endpoint('spaces', 'updates'), {
        withCredentials: true
      })
      eventSourceRef.current = eventSource

      eventSource.addEventListener('connected', () => {
        logger.debug('✅ SSE Updates: Conectado')
        setConnected(true)
        reconnectAttempts.current = 0
        lastHeartbeat.current = Date.now()
      })

      eventSource.addEventListener('heartbeat', () => {
        lastHeartbeat.current = Date.now()
      })

      eventSource.addEventListener('new_chapter', (event) => {
        try {
          const data = JSON.parse(event.data)
          handleNewChapter(data)
        } catch (e) {
          logger.error('Error parseando new_chapter:', e)
        }
      })

      eventSource.addEventListener('new_series', (event) => {
        try {
          const data = JSON.parse(event.data)
          handleNewSeries(data)
        } catch (e) {
          logger.error('Error parseando new_series:', e)
        }
      })

      eventSource.addEventListener('update', (event) => {
        try {
          const data = JSON.parse(event.data)
          logger.debug('🔄 Actualización:', data.type)
          setLastUpdate({ type: data.type, data, timestamp: Date.now() })

          if (data.series) {
            setUpdatedSeries(data.series)
          }

          onUpdate?.(data)
        } catch (e) {
          logger.error('Error parseando update:', e)
        }
      })

      eventSource.onerror = () => {
        setConnected(false)

        // Reconectar con backoff exponencial
        if (reconnectAttempts.current < CONFIG.maxReconnectAttempts) {
          const delay = CONFIG.baseReconnectDelay * Math.pow(2, reconnectAttempts.current)
          logger.debug(`🔄 SSE: Reconectando en ${delay}ms (intento ${reconnectAttempts.current + 1})`)

          setTimeout(() => {
            reconnectAttempts.current++
            connectRef.current?.()
          }, delay)
        } else {
          logger.warn('⚠️ SSE: Máximo de reintentos alcanzado. Usando solo REST.')
        }
      }

    } catch (e) {
      logger.error('Error creando EventSource:', e)
      setConnected(false)
    }
  }, [enabled, initialSeries.length, handleNewChapter, handleNewSeries, onUpdate])

  // Actualizar ref después de definir connect
  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  // Desconectar
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setConnected(false)
    logger.debug('🔌 SSE Updates: Desconectado')
  }, [])

  // Marcar items como vistos
  const clearNewItems = useCallback(() => {
    setNewItems([])
  }, [])

  // Solicitar permisos de notificación
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      return permission === 'granted'
    }
    return Notification.permission === 'granted'
  }, [])

  // Efecto: Conectar cuando hay datos iniciales
  useEffect(() => {
    let connectTimer = null
    if (enabled && initialSeries.length > 0) {
      // Programar la conexión de forma asíncrona para evitar setState dentro del effect
      connectTimer = setTimeout(() => {
        connectRef.current?.()
      }, 0)
    }

    return () => {
      if (connectTimer) clearTimeout(connectTimer)
      disconnect()
      if (heartbeatCheckInterval.current) {
        clearInterval(heartbeatCheckInterval.current)
      }
    }
  }, [enabled, initialSeries.length, disconnect])

  // Efecto: Verificar heartbeat (detectar conexión muerta)
  useEffect(() => {
    if (!connected) return
    heartbeatCheckInterval.current = setInterval(() => {
      const timeSinceHeartbeat = Date.now() - lastHeartbeat.current

      if (timeSinceHeartbeat > CONFIG.connectionTimeout) {
        console.warn('⚠️ SSE: Timeout de heartbeat, reconectando...')
        disconnect()
        connectRef.current?.()
      }
    }, CONFIG.heartbeatInterval)

    return () => {
      if (heartbeatCheckInterval.current) {
        clearInterval(heartbeatCheckInterval.current)
      }
    }
  }, [connected, connect, disconnect])

  return {
    // Estado
    connected,
    series: computedSeries,
    lastUpdate,
    newItems,
    hasUpdates: newItems.length > 0,

    // Acciones
    clearNewItems,
    reconnect: connect,
    disconnect,
    requestNotificationPermission,
  }
}

// Nota: Para usar hook combinado, importar ambos hooks:
// import { useSpaces } from './useSpaces'
// import { useSpacesUpdates } from './useSpacesUpdates'
// 
// Ejemplo de uso:
// const spaces = useSpaces()
// const updates = useSpacesUpdates(spaces.series, { onNewChapter: handleNew })

export default useSpacesUpdates
