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

  // Helper: localStorage key para guardar votos localmente
  const getStorageKey = (s) => `mi_series_rating_${s}`;

  // Inicializar FingerprintJS y obtener visitorId
  useEffect(() => {
    let mounted = true;
    const initFingerprint = async () => {
      try {
        if (typeof window === 'undefined') return;

        // Cargar FingerprintJS dinámicamente solo en cliente
        const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        if (mounted) setVisitorId(result.visitorId);
      } catch (e) {
        // Fallback ID silencioso
        if (typeof window !== 'undefined' && mounted) {
          let fid = localStorage.getItem('mi_visitor_id');
          if (!fid) {
            fid = 'anon_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('mi_visitor_id', fid);
          }
          setVisitorId(fid);
        }
      }
    };
    initFingerprint();
    return () => { mounted = false; };
  }, []);

  // Verificar si ya votó: Primero localStorage, luego API
  useEffect(() => {
    let mounted = true;

    // 1. Si viene initialRating del servidor (usuario logueado con voto previo)
    if (initialRating > 0) {
      setRating(Math.round(initialRating / 2));
      setHasRated(true);
      return;
    }

    // 2. Check localStorage para respuesta instantánea
    if (typeof window !== 'undefined' && slug) {
      const stored = localStorage.getItem(getStorageKey(slug));
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.rating && parsed.rating >= 1 && parsed.rating <= 5) {
            setRating(parsed.rating);
            setHasRated(true);
            // No retornamos — aún así verificamos con la API por si fue borrado
          }
        } catch (e) { /* ignore */ }
      }
    }

    // 3. Verificar con la API usando visitorId
    if (slug && visitorId) {
      const url = apiUrl(`series/${slug}/user-rating?visitorId=${visitorId}`);
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (mounted && data.success && data.rating) {
            const stars = Math.round(data.rating / 2);
            setRating(stars);
            setHasRated(true);
            // Sincronizar localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem(getStorageKey(slug), JSON.stringify({ rating: stars, visitorId }));
            }
          }
        })
        .catch(err => console.error("Error fetching user rating:", err));
    }

    return () => { mounted = false; };
  }, [slug, initialRating, visitorId]);

  useEffect(() => {
    setCurrentAverage(averageRating);
    setCurrentCount(totalRatings);
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
