"use client";

import React, { useRef, useEffect, useCallback, useState, lazy, Suspense } from 'react';
import styles from './ChapterImage.module.css';

const BlurhashCanvas = lazy(() => import('./BlurhashCanvas'));

const MAX_RETRIES = 2;

/**
 * Componente de imagen individual del capítulo con skeleton shimmer y transición.
 *
 * - pending:  solo skeleton (sin <img>)
 * - loading:  <img> oculta (opacity 0) + skeleton visible
 * - loaded:   transición opacity 0→1, skeleton desaparece
 * - error:    reintentos automáticos (hasta MAX_RETRIES), luego muestra aviso
 */
export default function ChapterImage({ page, index, status, onLoad, onError, registerRef, alt, totalPages }) {
  const containerRef = useRef(null);
  const [naturalHeight, setNaturalHeight] = useState(null);
  const [retries, setRetries] = useState(0);
  const [hasError, setHasError] = useState(false);

  const pageUrl = page?.url || '';

  // Resetear estado de error/retry cuando cambia la URL (nuevo capítulo)
  const prevUrl = useRef(pageUrl);
  useEffect(() => {
    if (prevUrl.current !== pageUrl) {
      prevUrl.current = pageUrl;
      setRetries(0);
      setHasError(false);
      setNaturalHeight(null);
    }
  }, [pageUrl]);

  // Registrar ref del contenedor en el hook padre
  useEffect(() => {
    if (containerRef.current && registerRef) {
      registerRef(index, containerRef.current);
    }
  }, [index, registerRef]);

  const handleLoad = useCallback((e) => {
    setHasError(false);
    const img = e.target;
    if (img.naturalHeight && img.naturalWidth) {
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      setNaturalHeight(aspectRatio);
    }
    onLoad(index);
  }, [index, onLoad]);

  const handleError = useCallback(() => {
    if (retries < MAX_RETRIES) {
      // Reintento automático (cache-bust para evitar respuesta cacheada del error)
      setRetries(r => r + 1);
    } else {
      // Agotados los reintentos: marcar error y desbloquear la cola
      setHasError(true);
      onError(index);
    }
  }, [retries, index, onError]);

  const isLoading = status === 'loading';
  const isLoaded = status === 'loaded' || status === 'error';
  const showImage = isLoading || isLoaded;
  // Añadir cache-bust solo en reintentos
  const imgSrc = pageUrl ? (retries > 0 ? `${pageUrl}?r=${retries}` : pageUrl) : '';

  return (
    <div
      ref={containerRef}
      data-image-index={index}
      className={styles.container}
      style={naturalHeight && isFinite(naturalHeight) && naturalHeight > 0 ? { minHeight: 'auto', aspectRatio: `1 / ${naturalHeight}` } : undefined}
    >
      {/* Placeholder: BlurhashCanvas si hay blurhash, sino skeleton shimmer */}
      {page.blurhash ? (
        <Suspense fallback={<div className={`${styles.skeleton} ${isLoaded ? styles.skeletonHidden : ''}`} />}>
          <BlurhashCanvas
            blurhash={page.blurhash}
            width={page.w}
            height={page.h}
            style={{
              transition: 'opacity 0.3s ease',
              opacity: isLoaded ? 0 : 1,
              pointerEvents: isLoaded ? 'none' : undefined,
            }}
          />
        </Suspense>
      ) : (
        <div className={`${styles.skeleton} ${isLoaded ? styles.skeletonHidden : ''}`} />
      )}

      {/* Indicador de carga visible: spinner + número de página */}
      {!hasError && (
        <div className={`${styles.loadingIndicator} ${isLoaded ? styles.loadingIndicatorHidden : ''}`}>
          <div className={styles.spinner} />
          <span className={styles.pageLabel}>
            {index + 1}{totalPages ? ` / ${totalPages}` : ''}
          </span>
        </div>
      )}

      {/* Imagen real - solo se renderiza cuando status es loading o loaded */}
      {showImage && !hasError && (
        <img
          src={imgSrc}
          alt={alt}
          className={`${styles.image} ${isLoaded ? styles.imageLoaded : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          decoding="async"
          fetchPriority={index < 3 ? 'high' : 'low'}
        />
      )}

      {/* Aviso de error tras agotar reintentos */}
      {hasError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: 'var(--dimmed-text, #888)',
          fontSize: '13px',
          minHeight: '80px',
        }}>
          <span style={{ fontSize: '24px', opacity: 0.5 }}>&#9888;</span>
          <span>Imagen {index + 1} no disponible</span>
          <button
            onClick={() => { setHasError(false); setRetries(0); }}
            style={{
              marginTop: '4px',
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
