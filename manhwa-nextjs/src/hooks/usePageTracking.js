/**
 * Hook React: usePageTracking
 * 
 * Abstracción simple para integrar BehaviorTracker en cualquier página
 * Maneja automáticamente:
 * - Inicialización en mount
 * - Cleanup en unmount
 * - Cambios de work/chapter
 * - Completion tracking
 */

import { useEffect, useRef, useCallback } from 'react';
import BehaviorTracker from '@/lib/tracker';

export const usePageTracking = (options = {}) => {
  const trackerRef = useRef(null);
  const {
    workId,
    chapterId,
    chapterNumber,
    enabled = true,
    onEventSent = null,
    apiBaseUrl = '/api/track',
    flushInterval = 30000
  } = options;

  // Inicializar tracker
  useEffect(() => {
    if (!enabled || !workId || !chapterId || !chapterNumber) {
      return;
    }

    try {
      trackerRef.current = new BehaviorTracker({
        workId,
        chapterId,
        chapterNumber,
        apiBaseUrl,
        flushInterval
      });

      trackerRef.current.start();

      if (process.env.NODE_ENV === 'development') {
        console.log('[usePageTracking] Started for', {
          workId,
          chapterId,
          chapterNumber
        });
      }
    } catch (error) {
      console.error('[usePageTracking] Initialization error:', error);
    }

    // Cleanup
    return () => {
      if (trackerRef.current) {
        trackerRef.current.stop();
      }
    };
  }, [enabled, workId, chapterId, chapterNumber, apiBaseUrl, flushInterval]);

  // Wrapper para trackEvent con callback
  const trackEvent = useCallback((eventType, metadata = {}) => {
    if (!trackerRef.current) return;

    const t = String(eventType || '').toLowerCase();
    if (t === 'progress_update' || t === 'scroll' || t === 'chapter_progress') {
      trackerRef.current.trackChapterProgress(true);
    } else if (t === 'session_end' || t === 'tab_close') {
      trackerRef.current.sendSessionEnd(metadata.exit_reason || 'user_left');
    } else if (t === 'chapter_complete') {
      trackerRef.current.trackChapterComplete(metadata);
    } else if (t === 'search_query') {
      trackerRef.current.trackSearchQuery(metadata.query_text, metadata.result_clicked_series_id || null);
    }

    if (onEventSent) {
      onEventSent({ eventType, metadata });
    }
  }, [onEventSent]);

  // Wrapper para chapter change
  const trackChapterChange = useCallback((newChapterNumber) => {
    if (trackerRef.current) {
      trackerRef.current.setChapter(newChapterNumber);
    }
  }, []);

  // Wrapper para progress
  const trackProgress = useCallback((chapterNum, isCompleted = false, timeMin = 0) => {
    if (trackerRef.current) {
      trackerRef.current.setChapter(chapterNum);
      if (isCompleted) {
        const seconds = Math.max(0, Math.round(Number(timeMin || 0) * 60));
        trackerRef.current.trackChapterComplete({
          seconds_on_page: seconds > 0 ? seconds : trackerRef.current.elapsedSeconds(),
          chapters_read_in_session: trackerRef.current.chaptersInSession + 1
        });
      } else {
        trackerRef.current.trackChapterProgress(true);
      }
    }
  }, []);

  return {
    trackEvent,
    trackChapterChange,
    trackProgress,
    isReady: !!trackerRef.current
  };
};

export default usePageTracking;
