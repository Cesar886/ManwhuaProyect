"use client";

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook que gestiona la carga secuencial de imágenes del capítulo.
 *
 * Fase 1: detecta imágenes visibles en el viewport inicial y las carga de inmediato.
 * Fase 2: una vez cargadas las del viewport, carga el resto en grupos adaptativos.
 * Pre-carga anticipada: un segundo observer con rootMargin adaptativo adelanta imágenes próximas.
 *
 * @param {Array} pages - Lista de páginas/imágenes del capítulo
 * @param {Object} networkConfig - { batchSize, lookaheadMargin } de getQueueConfig()
 * @param {Function} onAllLoaded - Callback cuando todas las imágenes terminan de cargar
 */
export default function useImageQueue(pages, networkConfig, onAllLoaded) {
  const [statuses, setStatuses] = useState(() => {
    const m = {};
    pages.forEach((_, i) => { m[i] = 'pending'; });
    return m;
  });

  // Refs mutables para evitar closures stale
  const statusesRef = useRef(statuses);
  const pagesRef = useRef(pages);
  const networkConfigRef = useRef(networkConfig);
  const onAllLoadedRef = useRef(onAllLoaded);
  const phase1Indices = useRef(new Set());
  const phase1Done = useRef(false);
  const queueRunning = useRef(false);
  const allLoadedFired = useRef(false);
  const itemRefs = useRef({}); // Map<index, HTMLElement>

  // Sincronizar refs
  useEffect(() => { statusesRef.current = statuses; }, [statuses]);
  useEffect(() => { networkConfigRef.current = networkConfig; }, [networkConfig]);
  useEffect(() => { onAllLoadedRef.current = onAllLoaded; }, [onAllLoaded]);
  useEffect(() => {
    pagesRef.current = pages;
    // Re-inicializar statuses si pages cambia (nuevo capítulo)
    const m = {};
    pages.forEach((_, i) => { m[i] = 'pending'; });
    setStatuses(m);
    phase1Indices.current = new Set();
    phase1Done.current = false;
    queueRunning.current = false;
    allLoadedFired.current = false;
  }, [pages]);

  const startLoading = useCallback((index) => {
    setStatuses(prev => {
      if (prev[index] === 'pending') {
        return { ...prev, [index]: 'loading' };
      }
      return prev;
    });
  }, []);

  const markLoaded = useCallback((index) => {
    setStatuses(prev => ({ ...prev, [index]: 'loaded' }));
  }, []);

  // Registrar ref del DOM de cada imagen
  const registerRef = useCallback((index, el) => {
    if (el) itemRefs.current[index] = el;
  }, []);

  // Callbacks por índice para la cola
  const batchCallbacks = useRef({});

  // Cola secuencial: carga grupos adaptativos tras fase 1
  const runQueue = useCallback(() => {
    if (queueRunning.current) return;
    queueRunning.current = true;

    const loadNextBatch = () => {
      const current = statusesRef.current;
      const total = pagesRef.current.length;
      const batchSize = networkConfigRef.current?.batchSize || 3;
      const batch = [];

      for (let i = 0; i < total && batch.length < batchSize; i++) {
        if (current[i] === 'pending') {
          batch.push(i);
        }
      }

      if (batch.length === 0) {
        queueRunning.current = false;
        // Todas cargadas → disparar callback
        if (!allLoadedFired.current) {
          allLoadedFired.current = true;
          onAllLoadedRef.current?.();
        }
        return;
      }

      // Marcar como loading
      setStatuses(prev => {
        const next = { ...prev };
        batch.forEach(i => { next[i] = 'loading'; });
        return next;
      });

      // Esperar a que terminen este grupo
      let loaded = 0;
      const checkBatch = () => {
        loaded++;
        if (loaded >= batch.length) {
          setTimeout(loadNextBatch, 0);
        }
      };

      batch.forEach(i => {
        batchCallbacks.current[i] = checkBatch;
      });
    };

    loadNextBatch();
  }, []);

  // Cuando un status cambia a 'loaded', disparar callback de batch si existe
  useEffect(() => {
    Object.entries(statuses).forEach(([idx, status]) => {
      if (status === 'loaded' && batchCallbacks.current[idx]) {
        const cb = batchCallbacks.current[idx];
        delete batchCallbacks.current[idx];
        cb();
      }
    });
  }, [statuses]);

  // Chequear si fase 1 terminó
  useEffect(() => {
    if (phase1Done.current) return;
    if (phase1Indices.current.size === 0) return;

    const allLoaded = [...phase1Indices.current].every(i => statuses[i] === 'loaded');
    if (allLoaded) {
      phase1Done.current = true;
      runQueue();
    }
  }, [statuses, runQueue]);

  // Fase 1: Observer para viewport inicial + Observer anticipatorio
  useEffect(() => {
    if (pages.length === 0) return;

    const lookaheadMargin = networkConfigRef.current?.lookaheadMargin || '600px';

    // Observer de viewport inicial (una sola vez)
    const viewportObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = Number(entry.target.dataset.imageIndex);
        if (entry.isIntersecting && statusesRef.current[idx] === 'pending') {
          phase1Indices.current.add(idx);
          startLoading(idx);
        }
      });
    }, { threshold: 0 });

    // Observer anticipatorio con margen adaptativo
    const lookaheadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const idx = Number(entry.target.dataset.imageIndex);
        if (entry.isIntersecting && statusesRef.current[idx] === 'pending') {
          startLoading(idx);
        }
      });
    }, { rootMargin: `${lookaheadMargin} 0px`, threshold: 0 });

    // Observar todos los elementos registrados
    const timeout = setTimeout(() => {
      Object.values(itemRefs.current).forEach(el => {
        viewportObserver.observe(el);
        lookaheadObserver.observe(el);
      });

      // Cerrar el viewport observer tras la detección inicial
      setTimeout(() => {
        viewportObserver.disconnect();
        // Si no hubo imágenes en viewport, arrancar cola directamente
        if (phase1Indices.current.size === 0) {
          phase1Done.current = true;
          runQueue();
        }
      }, 200);
    }, 50);

    return () => {
      clearTimeout(timeout);
      viewportObserver.disconnect();
      lookaheadObserver.disconnect();
    };
  }, [pages, startLoading, runQueue]);

  // Chequear si todas están cargadas (para caso donde no hay cola, e.g. pocas imágenes)
  useEffect(() => {
    if (allLoadedFired.current) return;
    if (pages.length === 0) return;
    const allDone = pages.every((_, i) => statuses[i] === 'loaded');
    if (allDone) {
      allLoadedFired.current = true;
      onAllLoadedRef.current?.();
    }
  }, [statuses, pages]);

  return { statuses, startLoading, markLoaded, registerRef };
}
