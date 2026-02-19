'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IconStar } from '@tabler/icons-react';
import { apiUrl } from '../config';

/**
 * ChapterRating - Calificación por capítulo con estrellas (1-5)
 * 
 * Usa FingerprintJS visitorId + Time Check para seguridad.
 * Persiste votos en localStorage para que las estrellas se mantengan al recargar.
 */
export default function ChapterRating({
  slug,
  chapterNum,
  onRated,
}) {
  const [chapterId, setChapterId] = useState(null);
  const [userRating, setUserRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [avgRating, setAvgRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [visitorId, setVisitorId] = useState(null);

  const mountTimeRef = useRef(Date.now());

  // Helper: localStorage key para persistencia de votos
  const getStorageKey = (s, ch) => `mi_chapter_rating_${s}_${ch}`;

  // Inicializar FingerprintJS y obtener visitorId
  useEffect(() => {
    let mounted = true;

    const initFingerprint = async () => {
      try {
        const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        if (mounted) setVisitorId(result.visitorId);
      } catch {
        // Fallback: usar un ID del localStorage
        let fallbackId = localStorage.getItem('mi_visitor_id');
        if (!fallbackId) {
          fallbackId = 'fb_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('mi_visitor_id', fallbackId);
        }
        if (mounted) setVisitorId(fallbackId);
      }
    };

    initFingerprint();
    return () => { mounted = false; };
  }, []);

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
      } catch (e) { /* ignore */ }
    }
  }, [slug, chapterNum]);

  // Cargar rating del capítulo y resolver chapterId
  useEffect(() => {
    if (!slug || !chapterNum) return;
    let mounted = true;

    const fetchRating = async () => {
      try {
        const res = await fetch(apiUrl(`chapters/${slug}/${chapterNum}/rating`));
        const data = await res.json();
        if (mounted && data.success && data.data) {
          setChapterId(data.data.chapterId);
          setAvgRating(parseFloat(data.data.rating) || 0);
          setRatingCount(parseInt(data.data.ratingCount, 10) || 0);
        }
      } catch {
        // Silently fail
      }
    };

    fetchRating();
    return () => { mounted = false; };
  }, [slug, chapterNum]);

  // Cargar voto previo del usuario desde la API
  useEffect(() => {
    if (!chapterId || !visitorId) return;

    const fetchUserRating = async () => {
      try {
        const res = await fetch(apiUrl(`chapters/${chapterId}/user-rating?visitorId=${visitorId}`));
        const data = await res.json();
        if (data.success && data.data?.userRating) {
          setUserRating(data.data.userRating);
          setHasRated(true);
          // Sincronizar localStorage
          if (typeof window !== 'undefined' && slug && chapterNum) {
            localStorage.setItem(
              getStorageKey(slug, chapterNum),
              JSON.stringify({ rating: data.data.userRating, visitorId })
            );
          }
        }
      } catch {
        // Silently fail — localStorage ya cubre este caso
      }
    };

    fetchUserRating();
  }, [chapterId, visitorId, slug, chapterNum]);

  const handleRate = useCallback(async (value) => {
    if (isSubmitting || !visitorId || !chapterId || hasRated) return;

    setIsSubmitting(true);

    try {
      const res = await fetch(apiUrl(`chapters/${chapterId}/rate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: value,
          visitorId,
          timestamp: new Date(mountTimeRef.current).toISOString()
        }),
      });

      const data = await res.json();

      if (data.success) {
        setUserRating(value);
        setHasRated(true);

        // Guardar en localStorage para persistencia al recargar
        if (typeof window !== 'undefined' && slug && chapterNum) {
          localStorage.setItem(
            getStorageKey(slug, chapterNum),
            JSON.stringify({ rating: value, visitorId })
          );
        }

        // Si entra en cuarentena (data.data.rating es null), mantenemos el promedio actual
        if (data.data && data.data.rating !== null && data.data.rating !== undefined) {
          setAvgRating(parseFloat(data.data.rating) || 0);
          setRatingCount(parseInt(data.data.ratingCount, 10) || 0);
        } else if (data.message && data.message.includes('revisión')) {
          console.info('Voto en revisión por alto tráfico.');
        }

        if (onRated) onRated(data.data);
      } else {
        alert(data.message || 'Error al calificar');
      }
    } catch (err) {
      console.error('Error rating chapter:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [chapterId, visitorId, isSubmitting, hasRated, onRated, slug, chapterNum]);

  const displayRating = avgRating > 0 ? avgRating.toFixed(1) : '0.0';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '16px 0',
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
          {displayRating} de 5 estrellas basado en {ratingCount} {ratingCount === 1 ? 'voto' : 'votos'}
        </p>
      )}

      {/* Estrellas interactivas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !hasRated && setHoverRating(star)}
            onMouseLeave={() => !hasRated && setHoverRating(0)}
            disabled={isSubmitting || !visitorId || !chapterId || hasRated}
            style={{
              background: 'none',
              border: 'none',
              cursor: (isSubmitting || hasRated) ? 'default' : 'pointer',
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
        color: 'var(--dimmed-text, #888)',
        margin: 0,
      }}>
        {hasRated
          ? `Tu calificación: ${userRating} estrellas`
          : (isSubmitting ? 'Enviando...' : 'Califica este capítulo')}
      </p>
    </div>
  );
}
