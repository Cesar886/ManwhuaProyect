'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Hook para obtener todos los capítulos leídos de una serie desde localStorage.
 * 
 * Lee las claves `chapter_read_${slug}_${chapterNum}` que guarda useReadingProgress
 * cuando el usuario llega al 90%+ de scroll en un capítulo.
 *
 * @param {string} slug - Slug de la serie
 * @param {Array} chapters - Lista de capítulos de la serie (para saber cuáles buscar)
 * @returns {{ readChapters: Set<string>, isChapterRead: (chapterNum) => boolean, refresh: () => void }}
 */
export function useReadChapters(slug, chapters) {
  const [readSet, setReadSet] = useState(new Set());

  const scanLocalStorage = useCallback(() => {
    if (typeof window === 'undefined' || !slug) return new Set();

    const result = new Set();

    try {
      // Si tenemos la lista de capítulos, solo buscamos esas claves específicas
      if (Array.isArray(chapters) && chapters.length > 0) {
        for (const ch of chapters) {
          const key = `chapter_read_${slug}_${ch.number}`;
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const data = JSON.parse(value);
              if (data?.read) {
                result.add(String(ch.number));
              }
            } catch { /* ignore parse errors */ }
          }
        }
      } else {
        // Fallback: escanear todas las claves de localStorage que coincidan con el patrón
        const prefix = `chapter_read_${slug}_`;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            try {
              const value = localStorage.getItem(key);
              const data = JSON.parse(value);
              if (data?.read) {
                const chapterNum = key.slice(prefix.length);
                result.add(chapterNum);
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch { /* localStorage not available */ }

    return result;
  }, [slug, chapters]);

  // Escanear al montar y cuando cambien slug/chapters  
  useEffect(() => {
    const result = scanLocalStorage();
    setReadSet(result);
  }, [scanLocalStorage]);

  // Escuchar cambios en localStorage (desde otras tabs o componentes)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      if (e.key && e.key.startsWith(`chapter_read_${slug}_`)) {
        setReadSet(scanLocalStorage());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [slug, scanLocalStorage]);

  const isChapterRead = useCallback((chapterNum) => {
    return readSet.has(String(chapterNum));
  }, [readSet]);

  const refresh = useCallback(() => {
    setReadSet(scanLocalStorage());
  }, [scanLocalStorage]);

  return useMemo(() => ({
    readChapters: readSet,
    isChapterRead,
    refresh,
    readCount: readSet.size,
  }), [readSet, isChapterRead, refresh]);
}

export default useReadChapters;
