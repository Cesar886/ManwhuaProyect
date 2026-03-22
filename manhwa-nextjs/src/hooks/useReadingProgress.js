'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { saveProgress as saveProgressAPI, getProgress as getProgressAPI, getDeviceId } from '../api/progress';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook ultra-optimizado para progreso de lectura persistente
 * Sin console logs - Manejo de errores silencioso
 */
export function useReadingProgress(slug, chapterNum, totalPages = 0) {
  const { user } = useAuth();
  const [progress, setProgress] = useState(0);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChapterReadState, setIsChapterReadState] = useState(false);

  const saveTimeoutRef = useRef(null);
  const lastSavedPosition = useRef(0);
  const deviceIdRef = useRef(null);
  const syncQueueRef = useRef([]);
  const isProcessingSyncRef = useRef(false);
  const rafIdRef = useRef(null);

  const storageKey = useMemo(
    () => `reading_progress_${slug}_${chapterNum}`,
    [slug, chapterNum]
  );

  const readKey = useMemo(
    () => `chapter_read_${slug}_${chapterNum}`,
    [slug, chapterNum]
  );

  // Inicializar deviceId
  useEffect(() => {
    if (typeof window !== 'undefined' && !deviceIdRef.current) {
      try {
        deviceIdRef.current = getDeviceId();
      } catch {
        // Silently fail
      }
    }
  }, []);

  // Cargar estado de "leído"
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(readKey);
      if (saved) {
        const data = JSON.parse(saved);
        setIsChapterReadState(!!data?.read);
      }
    } catch {
      // Silently fail
    }
  }, [readKey]);

  /**
   * Cargar progreso (backend primero, luego localStorage)
   */
  const loadProgress = useCallback(async () => {
    if (typeof window === 'undefined') return null;

    try {
      if (user) {
        try {
          const backendProgress = await getProgressAPI(slug, chapterNum);
          if (backendProgress) {
            const progressData = {
              position: backendProgress.scrollPosition || 0,
              progress: backendProgress.progress || 0,
              timestamp: backendProgress.syncedAt ? new Date(backendProgress.syncedAt).getTime() : Date.now(),
              totalPages: backendProgress.totalPages || 0,
            };

            try {
              localStorage.setItem(storageKey, JSON.stringify(progressData));
            } catch {
              // Silently fail if localStorage is full
            }

            return progressData;
          }
        } catch {
          // Silently fall back to localStorage
        }
      }

      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Silently fail
    }

    return null;
  }, [user, slug, chapterNum, storageKey]);

  /**
   * Procesar cola de sincronización
   */
  const processSyncQueue = useCallback(async () => {
    if (isProcessingSyncRef.current || syncQueueRef.current.length === 0 || !user) {
      return;
    }

    isProcessingSyncRef.current = true;
    setIsSyncing(true);

    try {
      const lastItem = syncQueueRef.current[syncQueueRef.current.length - 1];
      syncQueueRef.current = [];

      const parsedChapterNum = parseInt(lastItem.chapterNum);
      if (!parsedChapterNum || parsedChapterNum < 1) {
        return;
      }
      await saveProgressAPI({
        slug: lastItem.slug,
        chapterNum: parsedChapterNum,
        scrollPosition: lastItem.position || 0,
        progress: lastItem.progress || 0,
        totalPages: lastItem.totalPages || 0,
        isCompleted: lastItem.progress >= 90,
        deviceId: deviceIdRef.current,
      });
    } catch {
      // Silently fail - data is already in localStorage
    } finally {
      isProcessingSyncRef.current = false;
      setIsSyncing(false);

      if (syncQueueRef.current.length > 0) {
        setTimeout(() => processSyncQueue(), 100);
      }
    }
  }, [user]);

  /**
   * Guardar progreso
   */
  const saveProgressLocal = useCallback((position, progressPercent) => {
    if (typeof window === 'undefined') return;

    try {
      const positionDiff = Math.abs(position - lastSavedPosition.current);
      const minChange = Math.max(100, window.innerHeight * 0.05);

      if (positionDiff < minChange) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          const data = {
            position,
            progress: progressPercent,
            timestamp: Date.now(),
            totalPages,
          };

          localStorage.setItem(storageKey, JSON.stringify(data));
          lastSavedPosition.current = position;

          if (user) {
            syncQueueRef.current.push({
              slug,
              chapterNum,
              position,
              progress: progressPercent,
              totalPages,
            });
            processSyncQueue();
          }
        } catch {
          // Silently fail
        }
      }, 1000);
    } catch {
      // Silently fail
    }
  }, [storageKey, totalPages, user, slug, chapterNum, processSyncQueue]);

  /**
   * Calcular progreso
   */
  const calculateProgress = useCallback(() => {
    if (typeof window === 'undefined') return 0;

    try {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight || 1;
      const clientHeight = window.innerHeight || 1;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) return 0;

      return Math.min(100, Math.max(0, (scrollTop / maxScroll) * 100));
    } catch {
      return 0;
    }
  }, []);

  /**
   * Marcar como leído
   */
  const markAsRead = useCallback(() => {
    if (isChapterReadState) return;

    try {
      localStorage.setItem(readKey, JSON.stringify({
        read: true,
        timestamp: Date.now(),
      }));
      setIsChapterReadState(true);
    } catch {
      // Silently fail
    }
  }, [readKey, isChapterReadState]);

  /**
   * Limpiar progreso
   */
  const clearProgress = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setProgress(0);
      setScrollPosition(0);
      setHasRestoredPosition(false);
    } catch {
      // Silently fail
    }
  }, [storageKey]);

  /**
   * Listener de scroll optimizado
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastKnownScrollPosition = 0;
    let ticking = false;
    let scrollMounted = true;

    const handleScroll = () => {
      lastKnownScrollPosition = window.pageYOffset || document.documentElement.scrollTop || 0;

      if (!ticking) {
        rafIdRef.current = window.requestAnimationFrame(() => {
          if (!scrollMounted) { ticking = false; return; }
          try {
            const currentProgress = calculateProgress();

            setScrollPosition(lastKnownScrollPosition);
            setProgress(currentProgress);
            saveProgressLocal(lastKnownScrollPosition, currentProgress);

            if (currentProgress >= 90) {
              markAsRead();
            }
          } catch {
            // Silently fail
          }

          ticking = false;
        });

        ticking = true;
      }
    };

    try {
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
    } catch {
      // Silently fail
    }

    return () => {
      scrollMounted = false;
      try {
        window.removeEventListener('scroll', handleScroll);
        if (rafIdRef.current) {
          window.cancelAnimationFrame(rafIdRef.current);
        }
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
      } catch {
        // Silently fail
      }
    };
  }, [calculateProgress, saveProgressLocal, markAsRead]);

  /**
   * Restaurar posición
   */
  useEffect(() => {
    if (hasRestoredPosition || typeof window === 'undefined') return;

    let mounted = true;

    const restore = async () => {
      try {
        const saved = await loadProgress();

        if (!mounted || !saved || saved.position <= 0) {
          if (mounted) setHasRestoredPosition(true);
          return;
        }

        setTimeout(() => {
          if (!mounted) return;

          try {
            window.scrollTo({
              top: saved.position,
              behavior: 'instant',
            });
            setScrollPosition(saved.position);
            setProgress(saved.progress || 0);
          } catch {
            // Silently fail
          }

          setHasRestoredPosition(true);
        }, 150);
      } catch {
        if (mounted) setHasRestoredPosition(true);
      }
    };

    restore();

    return () => {
      mounted = false;
    };
  }, [slug, chapterNum, loadProgress, hasRestoredPosition]);

  return {
    progress,
    scrollPosition,
    hasRestoredPosition,
    isSyncing,
    isChapterRead: isChapterReadState,
    saveProgress: saveProgressLocal,
    markAsRead,
    clearProgress,
  };
}
