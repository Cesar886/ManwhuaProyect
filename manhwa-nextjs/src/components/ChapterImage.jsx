"use client";

import React, { useRef, useEffect, useCallback, useState, lazy, Suspense } from 'react';
import styles from './ChapterImage.module.css';

const BlurhashCanvas = lazy(() => import('./BlurhashCanvas'));

/**
 * Componente de imagen individual del capítulo con skeleton shimmer y transición.
 *
 * - pending:  solo skeleton (sin <img>)
 * - loading:  <img> oculta (opacity 0) + skeleton visible
 * - loaded:   transición opacity 0→1, skeleton desaparece
 */
export default function ChapterImage({ page, index, status, onLoad, registerRef, alt, totalPages }) {
  const containerRef = useRef(null);
  const [naturalHeight, setNaturalHeight] = useState(null);

  // Registrar ref del contenedor en el hook padre
  useEffect(() => {
    if (containerRef.current && registerRef) {
      registerRef(index, containerRef.current);
    }
  }, [index, registerRef]);

  const handleLoad = useCallback((e) => {
    // Ajustar altura del contenedor al tamaño real de la imagen
    const img = e.target;
    if (img.naturalHeight && img.naturalWidth) {
      const aspectRatio = img.naturalHeight / img.naturalWidth;
      setNaturalHeight(aspectRatio);
    }
    onLoad(index);
  }, [index, onLoad]);

  const isLoading = status === 'loading';
  const isLoaded = status === 'loaded';
  const showImage = isLoading || isLoaded;

  return (
    <div
      ref={containerRef}
      data-image-index={index}
      className={styles.container}
      style={naturalHeight ? { minHeight: 'auto', aspectRatio: `1 / ${naturalHeight}` } : undefined}
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
      <div className={`${styles.loadingIndicator} ${isLoaded ? styles.loadingIndicatorHidden : ''}`}>
        <div className={styles.spinner} />
        <span className={styles.pageLabel}>
          {index + 1}{totalPages ? ` / ${totalPages}` : ''}
        </span>
      </div>

      {/* Imagen real - solo se renderiza cuando status es loading o loaded */}
      {showImage && (
        <img
          src={page.url}
          alt={alt}
          className={`${styles.image} ${isLoaded ? styles.imageLoaded : ''}`}
          onLoad={handleLoad}
          decoding="async"
          fetchPriority={index < 3 ? 'high' : 'low'}
        />
      )}
    </div>
  );
}
