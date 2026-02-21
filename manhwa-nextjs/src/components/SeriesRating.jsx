'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { IconStar } from '@tabler/icons-react';
import { apiUrl } from '../config';

/**
 * SeriesRating - Componente de calificación con estrellas
 *
 * Props:
 * - slug: slug de la serie (para API call)
 * - initialRating: calificación del usuario (escala 1-10)
 * - averageRating: promedio de calificaciones (escala 1-10)
 * - totalRatings: número total de votos
 * - onRate: callback al votar
 * - compact: modo compacto (sin título)
 */
export default function SeriesRating({
  slug,
  initialRating = 0,
  averageRating = 0,
  totalRatings = 0,
  onRate,
  compact = false
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [currentAverage, setCurrentAverage] = useState(averageRating);
  const [currentCount, setCurrentCount] = useState(totalRatings);
  const [visitorId, setVisitorId] = useState(null);

  const mountTimeRef = useRef(Date.now());
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);
  const fpInitRef = useRef(false);
  const localVoteSetRef = useRef(false); // true tras votar: impide que props sobreescriban el estado local

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  // Helper: localStorage key para guardar votos localmente
  const getStorageKey = (s) => `mi_series_rating_${s}`;

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

  // Verificar voto previo al montar: initialRating del servidor o localStorage
  useEffect(() => {
    if (initialRating > 0) {
      setRating(Math.round(initialRating / 2));
      setHasRated(true);
      return;
    }
    if (typeof window !== 'undefined' && slug) {
      const stored = localStorage.getItem(getStorageKey(slug));
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.rating && parsed.rating >= 1 && parsed.rating <= 5) {
            setRating(parsed.rating);
            setHasRated(true);
          }
        } catch (e) { /* ignore */ }
      }
    }
  // Solo corre al montar (slug e initialRating no cambian)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verificar con la API una vez que visitorId esté disponible (solo la primera vez)
  const apiCheckedRef = useRef(false);
  useEffect(() => {
    if (!visitorId || !slug || apiCheckedRef.current) return;
    apiCheckedRef.current = true;
    let mounted = true;
    fetch(apiUrl(`series/${slug}/user-rating?visitorId=${visitorId}`))
      .then(res => res.json())
      .then(data => {
        if (mounted && data.success && data.rating) {
          const stars = Math.round(data.rating / 2);
          setRating(stars);
          setHasRated(true);
          if (typeof window !== 'undefined') {
            localStorage.setItem(getStorageKey(slug), JSON.stringify({ rating: stars, visitorId }));
          }
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [visitorId, slug]);

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

  // Fetch fresh rating from API on mount (bypasses SSR cache)
  useEffect(() => {
    if (!slug) return;
    let mounted = true;

    const fetchRating = async () => {
      try {
        const res = await fetch(apiUrl(`series/${slug}/rating`));
        const data = await res.json();
        if (mounted && data.success && data.data && !localVoteSetRef.current) {
          if (data.data.rating !== null && data.data.rating !== undefined) {
            setCurrentAverage(parseFloat(data.data.rating) || 0);
          }
          setCurrentCount(parseInt(data.data.ratingCount, 10) || 0);
        }
      } catch { /* Silently fail */ }
    };

    fetchRating();
    return () => { mounted = false; };
  }, [slug]);

  useEffect(() => {
    if (!localVoteSetRef.current) {
      setCurrentAverage(averageRating);
      setCurrentCount(totalRatings);
    }
  }, [averageRating, totalRatings]);

  const handleRate = useCallback(async (value) => {
    if (isSubmittingRef.current || hasRated || !visitorId) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const score = value * 2; // Convertir 1-5 estrellas a 2-10 score

    try {
      // Usar apiUrl para construir la URL correcta al backend
      const url = apiUrl(`series/${slug}/rate`);
      console.log('Rating series at:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: value, // 1-5 para validación
          score, // 2-10 para el controlador
          visitorId,
          timestamp: new Date(mountTimeRef.current).toISOString()
        }),
      });

      const data = await response.json();

      if (data.success) {
        setRating(value);
        setHasRated(true);
        localVoteSetRef.current = true;
        if (data.rating) setCurrentAverage(parseFloat(data.rating));
        if (data.ratingCount) setCurrentCount(parseInt(data.ratingCount, 10));

        // Guardar en localStorage para persistencia al recargar
        if (typeof window !== 'undefined') {
          localStorage.setItem(getStorageKey(slug), JSON.stringify({ rating: value, visitorId }));
        }

        if (onRate) onRate(score);
      } else {
        if (data.message) {
          console.warn(data.message);
          // Si ya existía el voto (409 conflict), marcamos como rated
          if (response.status === 409) {
            setHasRated(true);
            setRating(value);
            if (typeof window !== 'undefined') {
              localStorage.setItem(getStorageKey(slug), JSON.stringify({ rating: value, visitorId }));
            }
          }
        }
      }
    } catch (error) {
      console.error('Error rating series:', error);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [slug, visitorId, hasRated, onRate]);

  const displayAverage = currentAverage > 0 ? (currentAverage / 2).toFixed(1) : '0.0';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: compact ? '12px 0' : '24px 0',
        gap: '8px',
      }}
      role="region"
      aria-label={`Calificación: ${displayAverage} de 5 estrellas basaddo en ${currentCount} votos`}
    >
      {!compact && (
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 500,
          color: 'var(--text-color)',
          marginBottom: '4px',
        }}>
          {hasRated ? '¡Gracias por calificar!' : '¿Qué te pareció esta obra?'}
        </h3>
      )}

      {/* SEO Visible Text */}
      {(currentCount > 0 || hasRated) && (
        <p style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--imperial-gold, #f4c542)',
          margin: 0,
        }}>
          {displayAverage} ({currentCount} {currentCount === 1 ? 'voto' : 'votos'})
        </p>
      )}

      <div
        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
            disabled={isSubmitting || hasRated || !visitorId}
            style={{
              background: 'none',
              border: 'none',
              cursor: (isSubmitting || hasRated || !visitorId) ? 'default' : 'pointer',
              padding: '2px',
              transition: 'transform 0.15s ease',
              transform: (hoverRating !== 0 && hoverRating >= star && !hasRated) ? 'scale(1.15)' : 'scale(1)',
              opacity: (hasRated && rating < star) ? 0.3 : 1
            }}
            aria-label={hasRated ? `Tu calificación: ${rating} estrellas` : `Calificar con ${star} estrellas`}
            title={hasRated ? "Ya has calificado esta obra" : `Calificar con ${star} estrellas`}
          >
            <IconStar
              size={compact ? 28 : 32}
              fill={(hoverRating || rating) >= star ? '#FBBF24' : 'transparent'}
              color={(hoverRating || rating) >= star ? '#FBBF24' : 'var(--dimmed-text, #666)'}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      <p style={{
        fontSize: '0.85rem',
        color: 'var(--dimmed-text)',
        marginTop: '4px',
      }}>
        {hasRated
          ? `Tu calificación: ${rating} estrellas`
          : (isSubmitting ? 'Enviando...' : 'Toca una estrella para calificar')}
      </p>
    </div>
  );
}
