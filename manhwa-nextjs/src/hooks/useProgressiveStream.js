import { useState, useEffect, useRef, useCallback } from 'react';
import { endpoint } from '../config';
import logger from '../utils/logger';

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '';

/**
 * useProgressiveStream - Hook para carga progresiva via SSE
 * 
 * ARQUITECTURA HÍBRIDA:
 * - CAPA 1: Skeletons inmediatos (manejado por el componente)
 * - CAPA 2: Metadata via SSE streaming (este hook)
 * - CAPA 3: Imágenes lazy load (manejado por LazyImage)
 * 
 * Estados de carga:
 * - 'init': Estado inicial, preparando conexión
 * - 'connecting': Conectando al servidor SSE
 * - 'streaming': Recibiendo datos progresivamente
 * - 'complete': Todos los datos recibidos
 * - 'error': Error en la conexión
 * - 'cached': Usando datos de cache
 */

// Cache deshabilitado: no almacenar manhwas en sessionStorage

// Estados del streaming
export const STREAM_STATE = {
  INIT: 'init',
  CONNECTING: 'connecting',
  STREAMING: 'streaming',
  COMPLETE: 'complete',
  ERROR: 'error',
  CACHED: 'cached'
};

/**
 * Obtiene cache de sessionStorage
 */
// Cache deshabilitado — getCache no hace nada
const getCache = () => null;

/**
 * Guarda en cache
 */
// Cache deshabilitado — setCache es no-op
const setCache = () => {};

/**
 * Hook principal para streaming progresivo
 */
export function useProgressiveStream() {
  // Estado de manhwas (se va llenando progresivamente)
  const [manhwas, setManhwas] = useState([]);
  // Estado de la conexión
  const [streamState, setStreamState] = useState(STREAM_STATE.INIT);
  // Mensaje de progreso para UI
  const [progressMessage, setProgressMessage] = useState('');
  // Contadores de progreso
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  // Error si hay
  const [error, setError] = useState(null);
  // Tiempo de carga
  const [loadTime, setLoadTime] = useState(null);
  
  // Refs
  const eventSourceRef = useRef(null);
  const startTimeRef = useRef(null);
  const mountedRef = useRef(true);

  // Función para añadir manhwa (evita duplicados)
  const addManhwa = useCallback((newManhwa) => {
    setManhwas(prev => {
      // Evitar duplicados por slug
      if (prev.some(m => m.slug === newManhwa.slug)) {
        return prev;
      }
      const updated = [...prev, newManhwa];
      setProgress(p => ({ ...p, loaded: updated.length }));
      return updated;
    });
  }, []);

  // Función para establecer todos los manhwas de golpe
  const setAllManhwas = useCallback((allManhwas) => {
    setManhwas(allManhwas);
    setProgress({ loaded: allManhwas.length, total: allManhwas.length });
  }, []);

  // Conectar al stream SSE
  const connect = useCallback(() => {
    // Limpiar conexión anterior
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    startTimeRef.current = Date.now();
    setStreamState(STREAM_STATE.CONNECTING);
    setError(null);

    try {
      // Usar el endpoint de streaming progresivo
      const streamUrl = endpoint('spaces', 'stream-progressive');
      const eventSource = new EventSource(streamUrl, { withCredentials: true });
      eventSourceRef.current = eventSource;

      // Timeout de conexión
      const connectionTimeout = setTimeout(() => {
        if (eventSource.readyState !== EventSource.OPEN) {
          eventSource.close();
          handleConnectionError('Timeout de conexión');
        }
      }, 10000);

      // Evento: Conexión establecida
      eventSource.addEventListener('connected', (event) => {
        clearTimeout(connectionTimeout);
        setStreamState(STREAM_STATE.STREAMING);
        setProgressMessage('Cargando manhwas...');
        
        try {
          const data = JSON.parse(event.data);
          if (data.total) {
            setProgress(p => ({ ...p, total: data.total }));
          }
        } catch (e) {
          logger.warn('Error parsing connected event:', e);
        }
      });

      // Evento: Manhwa individual (streaming progresivo)
      eventSource.addEventListener('manhwa', (event) => {
        try {
          const manhwa = JSON.parse(event.data);
          addManhwa(manhwa);
        } catch (e) {
          logger.warn('Error parseando manhwa:', e);
        }
      });

      // Evento: Lote de manhwas (para eficiencia)
      eventSource.addEventListener('manhwa-batch', (event) => {
        try {
          const { manhwas: batch } = JSON.parse(event.data);
          batch.forEach(addManhwa);
        } catch (e) {
          logger.warn('Error parseando batch:', e);
        }
      });

      // Evento: Datos iniciales completos (fallback rápido)
      eventSource.addEventListener('initial', (event) => {
        try {
          const data = JSON.parse(event.data);
          const series = data.series || [];
          setAllManhwas(series);
          
          const elapsed = Date.now() - startTimeRef.current;
          setLoadTime(elapsed);
          setStreamState(STREAM_STATE.COMPLETE);
          setProgressMessage('');
          
          eventSource.close();
        } catch (e) {
          logger.error('Error parseando datos iniciales:', e);
        }
      });

      // Evento: Streaming completado
      eventSource.addEventListener('complete', (event) => {
        const elapsed = Date.now() - startTimeRef.current;
        setLoadTime(elapsed);
        setStreamState(STREAM_STATE.COMPLETE);
        setProgressMessage('');
        // Cache deshabilitado: no guardar en sessionStorage
        
        eventSource.close();
        
        try {
          const data = JSON.parse(event.data);
          logger.info(`✅ Streaming completo: ${data.total} manhwas en ${elapsed}ms`);
        } catch (e) {
          logger.warn('Error parsing complete event:', e);
        }
      });

      // Evento: Mensaje de progreso
      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data);
          setProgressMessage(data.message || 'Cargando...');
          if (data.loaded) {
            setProgress(p => ({ ...p, loaded: data.loaded }));
          }
          if (data.total) {
            setProgress(p => ({ ...p, total: data.total }));
          }
        } catch (e) {
          logger.warn('Error parsing progress event:', e);
        }
      });

      // Error de conexión
      eventSource.onerror = () => {
        clearTimeout(connectionTimeout);
        if (eventSource.readyState === EventSource.CLOSED) {
          handleConnectionError('Conexión cerrada');
        }
      };

      // Función para manejar errores
      const handleConnectionError = (message) => {
        if (!mountedRef.current) return;
        
        eventSource.close();
        
        // Intentar fallback a API REST
        logger.warn(`⚠️ SSE Error: ${message}, intentando API REST...`);
        loadViaApi();
      };

    } catch (e) {
      logger.error('Error creando EventSource:', e);
      loadViaApi();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addManhwa, setAllManhwas]);

  // Fallback: Cargar via API REST
  const loadViaApi = useCallback(async () => {
    setStreamState(STREAM_STATE.CONNECTING);
    setProgressMessage('Cargando desde API...');
    
    try {
      const response = await fetch(endpoint('spaces', 'manhwas'), {
        credentials: 'include',
        headers: { ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const series = data.data?.series || [];
      
      setAllManhwas(series);
      // Cache deshabilitado: no guardar
      
      const elapsed = Date.now() - startTimeRef.current;
      setLoadTime(elapsed);
      setStreamState(STREAM_STATE.COMPLETE);
      setProgressMessage('');
      
    } catch (e) {
      console.error('Error cargando via API:', e);
      setError('Error cargando manhwas. Intenta recargar la página.');
      setStreamState(STREAM_STATE.ERROR);
    }
  }, [setAllManhwas]);

  // Forzar recarga
  const refresh = useCallback(() => {
    setManhwas([]);
    setProgress({ loaded: 0, total: 0 });
    connect();
  }, [connect]);

  // Inicialización
  useEffect(() => {
    mountedRef.current = true;
    
    // Cache deshabilitado: conectar al stream directamente
    connect();

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect, setAllManhwas]);

  return {
    manhwas,
    streamState,
    progressMessage,
    progress,
    error,
    loadTime,
    refresh,
    // Helpers de estado
    isLoading: streamState === STREAM_STATE.INIT || 
               streamState === STREAM_STATE.CONNECTING ||
               streamState === STREAM_STATE.STREAMING,
    isComplete: streamState === STREAM_STATE.COMPLETE || 
                streamState === STREAM_STATE.CACHED,
    isError: streamState === STREAM_STATE.ERROR,
    isCached: streamState === STREAM_STATE.CACHED
  };
}

export default useProgressiveStream;
