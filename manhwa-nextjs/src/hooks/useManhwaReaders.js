'use client';

import { useState, useEffect, useRef } from 'react';
import { ENDPOINTS } from '@/config';

/**
 * useManhwaReaders — suscribe via SSE a quién está leyendo un manhwa
 * (desde detalle o cualquier capítulo del mismo slug) en tiempo real.
 * 
 * Si SSE falla, hace polling automáticamente como fallback.
 *
 * @param {string} slug - Slug del manhwa
 * @returns {{ count: number, readers: Array<{userId, username, displayName, avatarUrl}>, isConnected: boolean }}
 */
export function useManhwaReaders(slug, { enabled = true } = {}) {
  const [data, setData] = useState({ count: 0, readers: [] });
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // Función para hacer polling REST como fallback con exponential backoff
  const pollReaders = async (retries = 0) => {
    if (!slug) return;
    
    try {
      const response = await fetch(
        `${ENDPOINTS.presence}/manhwa/${encodeURIComponent(slug)}/list`,
        { 
          credentials: 'include',
          signal: AbortSignal.timeout(5000) // Timeout de 5s
        }
      );
      
      if (response.ok) {
        const d = await response.json();
        if (d && typeof d === 'object') {
          const readers = Array.isArray(d.readers) ? d.readers : [];
          // Validación estricta
          const validReaders = readers.filter((r) => 
            r && 
            typeof r === 'object' && 
            (r.userId || r.username) &&
            r.displayName
          );
          setData({ 
            count: Math.max(0, validReaders.length), 
            readers: validReaders 
          });
        }
      } else if (response.status !== 401) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      // Retry con backoff exponencial
      if (retries < 3) {
        const delay = Math.min(1000 * Math.pow(2, retries), 5000);
        setTimeout(() => pollReaders(retries + 1), delay);
      }
    }
  };

  useEffect(() => {
    if (!slug || !enabled) {
      setData({ count: 0, readers: [] });
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      // Limpiar polling cuando SSE conecta
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      const url = `${ENDPOINTS.presence}/manhwa/${encodeURIComponent(slug)}/stream`;

      try {
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          reconnectAttempts.current = 0;
          // Limpiar polling cuando SSE está conectado
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        };

        es.onmessage = (e) => {
          try {
            const d = JSON.parse(e.data);
            if (d && typeof d === 'object') {
              const readers = Array.isArray(d.readers) ? d.readers : [];
              const count = typeof d.count === 'number' ? d.count : readers.length;
              const validReaders = readers.filter((r) => r && typeof r === 'object' && (r.userId || r.username));
              setData({ count, readers: validReaders });
            }
          } catch (err) {
            console.error('[ManhwaReaders] Error al parsear datos:', err);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es.close();

          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);

          if (reconnectAttempts.current <= 10) {
            // Intentar reconectar
            reconnectTimeoutRef.current = setTimeout(connect, delay);
            
            // Activar polling mientras SSE está muerto
            if (!pollingIntervalRef.current) {
              pollingIntervalRef.current = setInterval(() => {
                pollReaders(0); // Reset retries
              }, 6000); // Polling cada 6s
            }
          } else {
            // Después de 10 intentos, solo polling
            setData({ count: 0, readers: [] });
            if (!pollingIntervalRef.current) {
              pollingIntervalRef.current = setInterval(() => {
                pollReaders(0);
              }, 6000);
            }
          }
        };
      } catch (err) {
        console.error('[ManhwaReaders] Error al crear EventSource:', err);
        setIsConnected(false);
        
        // Fallback a polling si no se puede crear EventSource
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(() => {
            pollReaders(0);
          }, 6000);
        }
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setIsConnected(false);
      setData({ count: 0, readers: [] });
    };
  }, [slug, enabled]);

  return { ...data, isConnected };
}
