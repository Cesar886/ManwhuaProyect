'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { saveProgress as saveProgressAPI, getProgress as getProgressAPI, getDeviceId } from '../api/progress';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook para progreso de lectura persistente
 * Guarda en localStorage + backend (si autenticado)
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
  const lastSyncedProgress = useRef(0);
  const deviceIdRef = useRef(null);
  const pendingSyncRef = useRef(null);
  const rafIdRef = useRef(null);
  const userRef = useRef(user);
  const slugRef = useRef(slug);
  const chapterNumRef = useRef(chapterNum);
  const totalPagesRef = useRef(totalPages);

  // Mantener refs actualizadas
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { slugRef.current = slug; }, [slug]);
  useEffect(() => { chapterNumRef.current = chapterNum; }, [chapterNum]);
  useEffect(() => { totalPagesRef.current = totalPages; }, [totalPages]);

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
      } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }, [readKey]);

  /**
   * Enviar progreso al backend
   */
  const syncToBackend = useCallback(async (data) => {
    if (!userRef.current) return;

    const chNum = parseFloat(data.chapterNum);
    if (!data.slug || !chNum || chNum < 0.1) return;

    setIsSyncing(true);
    try {
      await saveProgressAPI({
        slug: data.slug,
        chapterNum: chNum,
        scrollPosition: data.position || 0,
        progress: data.progress || 0,
        totalPages: data.totalPages || 0,
        isCompleted: data.progress >= 90,
        deviceId: deviceIdRef.current,
      });
      lastSyncedProgress.current = data.progress || 0;
    } catch { /* error handled in saveProgressAPI */ }
    finally { setIsSyncing(false); }
  }, []);

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
            } catch { /* ignore */ }
            return progressData;
          }
        } catch { /* fall back to localStorage */ }
      }

      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }

    return null;
  }, [user, slug, chapterNum, storageKey]);

  /**
   * Guardar progreso (local + cola de sync)
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

          // Preparar sync al backend
          pendingSyncRef.current = {
            slug,
            chapterNum,
            position,
            progress: progressPercent,
            totalPages,
          };

          // Sync al backend: cada 5% de avance o si completó
          const progressDiff = Math.abs(progressPercent - lastSyncedProgress.current);
          if (userRef.current && (progressDiff >= 5 || progressPercent >= 90)) {
            syncToBackend(pendingSyncRef.current);
            pendingSyncRef.current = null;
          }
        } catch { /* ignore */ }
      }, 800);
    } catch { /* ignore */ }
  }, [storageKey, totalPages, slug, chapterNum, syncToBackend]);

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
    } catch { return 0; }
  }, []);

  /**
   * Marcar como leído
   */
  const markAsRead = useCallback(() => {
    if (isChapterReadState) return;
    try {
      localStorage.setItem(readKey, JSON.stringify({ read: true, timestamp: Date.now() }));
      setIsChapterReadState(true);
    } catch { /* ignore */ }
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
    } catch { /* ignore */ }
  }, [storageKey]);

  /**
   * Flush: enviar cualquier progreso pendiente al backend
   */
  const flushSync = useCallback(() => {
    // Limpiar timeout pendiente y guardar en localStorage inmediatamente
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Si hay datos pendientes, enviar al backend
    if (pendingSyncRef.current && userRef.current) {
      syncToBackend(pendingSyncRef.current);
      pendingSyncRef.current = null;
    }
  }, [syncToBackend]);

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
          } catch { /* ignore */ }
          ticking = false;
        });
        ticking = true;
      }
    };

    try {
      window.addEventListener('scroll', handleScroll, { passive: true });
      handleScroll();
    } catch { /* ignore */ }

    return () => {
      scrollMounted = false;
      try {
        window.removeEventListener('scroll', handleScroll);
        if (rafIdRef.current) window.cancelAnimationFrame(rafIdRef.current);
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      } catch { /* ignore */ }
    };
  }, [calculateProgress, saveProgressLocal, markAsRead]);

  /**
   * Al desmontar o cambiar de capítulo: flush progreso pendiente al backend
   */
  useEffect(() => {
    return () => {
      // Flush en el cleanup del effect
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Guardar lo que haya pendiente
      if (pendingSyncRef.current && userRef.current) {
        // Usar sendBeacon para garantizar envío incluso al cerrar página
        try {
          const payload = {
            slug: pendingSyncRef.current.slug,
            chapterNum: parseFloat(pendingSyncRef.current.chapterNum),
            scrollPosition: pendingSyncRef.current.position || 0,
            progress: pendingSyncRef.current.progress || 0,
            totalPages: pendingSyncRef.current.totalPages || 0,
            isCompleted: (pendingSyncRef.current.progress || 0) >= 90,
            deviceId: deviceIdRef.current,
          };
          // Fire-and-forget sync
          saveProgressAPI(payload).catch(() => {});
        } catch { /* ignore */ }
        pendingSyncRef.current = null;
      }
    };
  }, [slug, chapterNum]);

  /**
   * Usar visibilitychange + beforeunload para flush
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushSync();
      }
    };

    const handleBeforeUnload = () => {
      flushSync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [flushSync]);

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
            window.scrollTo({ top: saved.position, behavior: 'instant' });
            setScrollPosition(saved.position);
            setProgress(saved.progress || 0);
          } catch { /* ignore */ }
          setHasRestoredPosition(true);
        }, 150);
      } catch {
        if (mounted) setHasRestoredPosition(true);
      }
    };

    restore();

    return () => { mounted = false; };
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
