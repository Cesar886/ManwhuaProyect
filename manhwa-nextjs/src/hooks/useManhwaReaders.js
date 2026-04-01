'use client';

import { useState, useEffect, useRef } from 'react';
import { ENDPOINTS } from '@/config';

/**
 * useManhwaReaders — suscribe via SSE a quién está leyendo un manhwa
 * (desde detalle o cualquier capítulo del mismo slug) en tiempo real.
 *
 * @param {string} slug - Slug del manhwa
 * @returns {{ count: number, readers: Array<{userId, username, displayName, avatarUrl}>, isConnected: boolean }}
 */
export function useManhwaReaders(slug) {
  const [data, setData] = useState({ count: 0, readers: [] });
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!slug) {
      setData({ count: 0, readers: [] });
      setIsConnected(false);
      return;
    }

    const connect = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const url = `${ENDPOINTS.presence}/manhwa/${encodeURIComponent(slug)}/stream`;

      try {
        const es = new EventSource(url, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          reconnectAttempts.current = 0;
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

        es.onerror = (err) => {
          setIsConnected(false);
          es.close();

          if (err?.status === 401 || err?.type === 'error') {
            setData({ count: 0, readers: [] });
            return;
          }

          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);

          if (reconnectAttempts.current <= 5) {
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else {
            setData({ count: 0, readers: [] });
          }
        };
      } catch (err) {
        console.error('[ManhwaReaders] Error al crear EventSource:', err);
        setIsConnected(false);
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
      setIsConnected(false);
      setData({ count: 0, readers: [] });
    };
  }, [slug]);

  return { ...data, isConnected };
}
