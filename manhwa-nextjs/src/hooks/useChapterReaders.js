'use client';

import { useState, useEffect, useRef } from 'react';
import { ENDPOINTS } from '@/config';

/**
 * useChapterReaders — suscribe via SSE a quién está leyendo un capítulo en tiempo real.
 *
 * @param {string} slug    - Slug del manhwa
 * @param {string|number} numero - Número del capítulo
 * @returns {{ count: number, readers: Array<{userId, username, displayName, avatarUrl}>, isConnected: boolean }}
 */
export function useChapterReaders(slug, numero, { enabled = true } = {}) {
    const [data, setData] = useState({ count: 0, readers: [] });
    const [isConnected, setIsConnected] = useState(false);
    const eventSourceRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const reconnectAttempts = useRef(0);

    useEffect(() => {
        if (!slug || !numero || !enabled) {
            setData({ count: 0, readers: [] });
            setIsConnected(false);
            return;
        }

        const connect = () => {
            // Limpiar conexión previa si existe
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }

            const url = `${ENDPOINTS.presence}/chapter/${encodeURIComponent(slug)}/${encodeURIComponent(numero)}/stream`;
            
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
                        
                        // Validar estructura de datos
                        if (d && typeof d === 'object') {
                            const readers = Array.isArray(d.readers) ? d.readers : [];
                            const count = typeof d.count === 'number' ? d.count : readers.length;
                            
                            // Filtrar lectores válidos
                            const validReaders = readers.filter(r => 
                                r && 
                                (r.userId || r.username) && 
                                typeof r === 'object'
                            );

                            setData({ 
                                count, 
                                readers: validReaders 
                            });
                        }
                    } catch (err) {
                        console.error('[ChapterReaders] Error al parsear datos:', err);
                    }
                };

                es.onerror = () => {
                    setIsConnected(false);
                    es.close();

                    // Reconectar con backoff exponencial
                    reconnectAttempts.current++;
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 30000);

                    if (reconnectAttempts.current <= 5) {
                        reconnectTimeoutRef.current = setTimeout(connect, delay);
                    } else {
                        setData({ count: 0, readers: [] });
                    }
                };

            } catch (err) {
                console.error('[ChapterReaders] Error al crear EventSource:', err);
                setIsConnected(false);
            }
        };

        // Iniciar conexión
        connect();

        // Cleanup
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
    }, [slug, numero, enabled]);

    return { ...data, isConnected };
}
