"use client";

import { useEffect, useRef } from 'react';

/**
 * Hook que pre-carga imágenes del siguiente capítulo cuando el actual termina.
 *
 * @param {Object} options
 * @param {string} options.slug - Slug de la serie
 * @param {number|string|null} options.nextChapterNum - Número del siguiente capítulo
 * @param {Object} options.networkConfig - Config de getQueueConfig()
 * @param {boolean} options.enabled - true cuando el capítulo actual terminó de cargar
 */
export default function useNextChapterPrefetch({ slug, nextChapterNum, networkConfig, enabled }) {
  const abortRef = useRef(null);
  const timerRef = useRef(null);
  const linksRef = useRef([]);

  useEffect(() => {
    // Limpiar al cambiar dependencias o desmontar
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
      linksRef.current.forEach(link => link.remove());
      linksRef.current = [];
    };
  }, [slug, nextChapterNum, enabled]);

  useEffect(() => {
    if (!enabled || !slug || nextChapterNum == null) return;
    if (!networkConfig?.prefetchNextChapter) return;

    const { prefetchDelay, prefetchImageCount } = networkConfig;
    if (!prefetchImageCount || prefetchImageCount <= 0) return;

    const spacesUrl = process.env.NEXT_PUBLIC_DO_SPACES_URL;
    if (!spacesUrl) return;

    const controller = new AbortController();
    abortRef.current = controller;

    timerRef.current = setTimeout(async () => {
      try {
        const paddedChapter = String(nextChapterNum).padStart(2, '0');
        const imagesJsonUrl = `${spacesUrl}/${slug}/cap-${paddedChapter}/images.json`;

        const res = await fetch(imagesJsonUrl, {
          signal: controller.signal,
          priority: 'low',
        });

        if (!res.ok || controller.signal.aborted) return;

        const images = await res.json();
        if (!Array.isArray(images) || controller.signal.aborted) return;

        const count = prefetchImageCount === Infinity ? images.length : Math.min(prefetchImageCount, images.length);
        const toPrefetch = images.slice(0, count);

        // Inyectar <link rel="prefetch"> para cada imagen
        const supportsLinkPrefetch = typeof HTMLLinkElement !== 'undefined' && 'relList' in HTMLLinkElement.prototype;

        toPrefetch.forEach(img => {
          const url = img.url || img;
          if (controller.signal.aborted) return;

          if (supportsLinkPrefetch) {
            const link = document.createElement('link');
            link.rel = 'prefetch';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
            linksRef.current.push(link);
          } else {
            // Fallback: new Image()
            const image = new Image();
            image.src = url;
          }
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[prefetch] Error prefetching next chapter:', err);
        }
      }
    }, prefetchDelay || 2000);

    return () => {
      clearTimeout(timerRef.current);
      controller.abort();
      linksRef.current.forEach(link => link.remove());
      linksRef.current = [];
    };
  }, [enabled, slug, nextChapterNum, networkConfig]);
}
