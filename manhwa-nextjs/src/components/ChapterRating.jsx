'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IconStar } from '@tabler/icons-react';
import { apiUrl } from '../config';

/**
 * ChapterRating - Calificación por capítulo con estrellas (1-5)
 *
 * Usa FingerprintJS visitorId + Time Check para seguridad.
 * Persiste votos en localStorage para que las estrellas se mantengan al recargar.
 * No depende de la tabla chapters (vacía); usa series_slug + chapter_number directamente.
 */
export default function ChapterRating({ slug, chapterNum, onRated }) {
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [visitorId, setVisitorId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // El timer anti-bot arranca cuando visitorId está disponible (no al montar)
  const mountTimeRef = useRef(null);
  const isMountedRef = useRef(true);
  const fpInitRef = useRef(false);
  const apiCheckedRef = useRef(false);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const getStorageKey = (s, ch) => `mi_chapter_rating_${s}_${ch}`;

  // Inicializar FingerprintJS (lazy pero garantizado al montar)
  const initFingerprintOnDemand = useCallback(async () => {
    if (fpInitRef.current) return;
    fpInitRef.current = true;

    try {
      const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      if (isMountedRef.current) {
        // Guardar en localStorage para que sea el mismo ID en próximas recargas
        localStorage.setItem('mi_visitor_id', result.visitorId);
        setVisitorId(result.visitorId);
      }
    } catch {
      // El ID de localStorage ya fue establecido en el useEffect de montaje
    }
  }, []);

  // Inicializar visitorId al montar: inmediato desde localStorage, mejorar con FingerprintJS
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 1. Establecer ID de forma síncrona para que los botones estén habilitados de inmediato
    let fid = localStorage.getItem('mi_visitor_id');
    if (!fid) {
      fid = 'anon_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      localStorage.setItem('mi_visitor_id', fid);
    }
    setVisitorId(fid);
    // 2. Intentar mejorar con FingerprintJS en background (no bloquea la UI)
    initFingerprintOnDemand();
  }, [initFingerprintOnDemand]);

  // Registrar cuándo el usuario puede empezar a votar (para anti-bot)
  useEffect(() => {
    if (visitorId && mountTimeRef.current === null) {
      mountTimeRef.current = Date.now();
    }
  }, [visitorId]);

  // Check localStorage inmediatamente para mostrar estrellas al instante
  useEffect(() => {
    if (typeof window === 'undefined' || !slug || !chapterNum) return;

    const stored = localStorage.getItem(getStorageKey(slug, chapterNum));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.rating && parsed.rating >= 1 && parsed.rating <= 5) {
          setUserRating(parsed.rating);
          setHasRated(true);
        }
      } catch { /* ignore */ }
    }
  }, [slug, chapterNum]);

  // Cargar rating promedio del capítulo
  useEffect(() => {
    if (!slug || !chapterNum) return;
    let mounted = true;

    const fetchRating = async () => {
      try {
        const res = await fetch(apiUrl(`chapters/${slug}/${chapterNum}/rating`));
        const data = await res.json();
        if (mounted && data.success && data.data) {
          setAvgRating(parseFloat(data.data.rating) || 0);
          setRatingCount(parseInt(data.data.ratingCount, 10) || 0);
        }
      } catch { /* Silently fail */ }
    };

    fetchRating();
    return () => { mounted = false; };
  }, [slug, chapterNum]);

  // Cargar voto previo del usuario desde la API (solo la primera vez que visitorId esté disponible)
  useEffect(() => {
    if (!visitorId || !slug || !chapterNum || apiCheckedRef.current) return;
    apiCheckedRef.current = true;
    let mounted = true;

    fetch(apiUrl(`chapters/${slug}/${chapterNum}/user-rating?visitorId=${visitorId}`))
      .then(res => res.json())
      .then(data => {
        if (mounted && data.success && data.data?.userRating) {
          setUserRating(data.data.userRating);
          setHasRated(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem(
              getStorageKey(slug, chapterNum),
              JSON.stringify({ rating: data.data.userRating, visitorId })
            );
          }
        }
      })
      .catch(() => {});

    return () => { mounted = false; };
  }, [visitorId, slug, chapterNum]);

  const handleRate = useCallback(async (value) => {
    if (isSubmitting || !visitorId || hasRated) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(apiUrl(`chapters/${slug}/${chapterNum}/rate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: value,
          visitorId,
          timestamp: mountTimeRef.current != null
            ? new Date(mountTimeRef.current).toISOString()
            : undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setUserRating(value);
        setHasRated(true);

        if (typeof window !== 'undefined' && slug && chapterNum) {
          localStorage.setItem(
            getStorageKey(slug, chapterNum),
            JSON.stringify({ rating: value, visitorId })
          );
        }

        if (data.data && data.data.rating !== null && data.data.rating !== undefined) {
          setAvgRating(parseFloat(data.data.rating) || 0);
          setRatingCount(parseInt(data.data.ratingCount, 10) || 0);
        }

        if (onRated) onRated(data.data);
      } else {
        setErrorMsg(data.message || 'Error al calificar');
      }
    } catch {
      setErrorMsg('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }, [visitorId, isSubmitting, hasRated, onRated, slug, chapterNum]);

  const displayRating = avgRating > 0 ? avgRating.toFixed(1) : '0.0';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '56px 0px 1px',
      }}
      role="region"
      aria-label={`Calificación del capítulo: ${displayRating} de 5 estrellas basado en ${ratingCount} votos`}
    >
      {/* Texto visible del rating - CRÍTICO PARA SEO */}
      {ratingCount > 0 && (
        <p style={{
          fontSize: '14px',
          fontWeight: '600',
          color: 'var(--imperial-gold, #f4c542)',
          margin: 0,
        }}>
          {displayRating} ({ratingCount} {ratingCount === 1 ? 'voto' : 'votos'})
        </p>
      )}

      {/* Estrellas interactivas */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        onMouseEnter={initFingerprintOnDemand}
        onFocus={initFingerprintOnDemand}
        onTouchStart={initFingerprintOnDemand}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !hasRated && setHoverRating(star)}
            onMouseLeave={() => !hasRated && setHoverRating(0)}
            disabled={isSubmitting || !visitorId || hasRated}
            style={{
              background: 'none',
              border: 'none',
              cursor: (isSubmitting || hasRated || !visitorId) ? 'default' : 'pointer',
              padding: '2px',
              transition: 'transform 0.15s ease',
              transform: (!hasRated && hoverRating === star) ? 'scale(1.15)' : 'scale(1)',
              opacity: (hasRated && userRating < star) ? 0.3 : 1
            }}
            aria-label={hasRated ? `Tu calificación: ${userRating} estrellas` : `Calificar con ${star} estrellas`}
          >
            <IconStar
              size={28}
              fill={(hoverRating || userRating) >= star ? '#FBBF24' : 'transparent'}
              color={(hoverRating || userRating) >= star ? '#FBBF24' : 'var(--dimmed-text, #666)'}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <p style={{
        fontSize: '12px',
        color: errorMsg ? 'var(--error-color, #ef4444)' : 'var(--dimmed-text, #888)',
        margin: 0,
      }}>
        {hasRated
          ? `Tu calificación: ${userRating} estrellas`
          : errorMsg
            ? errorMsg
            : (isSubmitting ? 'Enviando...' : 'Califica este capítulo')}
      </p>
    </div>
  );
}
