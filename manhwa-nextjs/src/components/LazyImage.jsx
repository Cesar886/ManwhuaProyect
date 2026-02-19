import { useState, useEffect, useRef } from 'react';
import classes from './LazyImage.module.css';

/**
 * LazyImage - Componente de imagen con carga progresiva
 * CAPA 3: Lazy loading con blur-up effect
 * 
 * Características:
 * - Intersection Observer para lazy loading
 * - Blur-up effect (placeholder → imagen completa)
 * - Fallback para imágenes que fallan
 * - Transición suave CSS
 */
export default function LazyImage({
  src,
  alt,
  placeholder,
  className,
  style,
  aspectRatio = '3/4',
  fallbackColor = 'var(--subtle-bg)',
  onLoad,
  onError,
  ...props
}) {
  const [imageState, setImageState] = useState('loading'); // loading | loaded | error
  const [isInViewport, setIsInViewport] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(null);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Generar placeholder dinámico si no se proporciona
  const placeholderBg = placeholder || generatePlaceholder(alt || 'manhwa');

  // Intersection Observer para lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInViewport(true);
            observer.unobserve(container);
          }
        });
      },
      {
        rootMargin: '100px', // Pre-carga 100px antes de entrar al viewport
        threshold: 0.01
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Cargar imagen cuando entra al viewport
  useEffect(() => {
    if (!isInViewport || !src) return;

    const img = new Image();

    img.onload = () => {
      setCurrentSrc(src);
      setImageState('loaded');
      setTimeout(() => setShowPlaceholder(false), 150);
      onLoad?.();
    };

    img.onerror = () => {
      setImageState('error');
      onError?.();
    };

    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [isInViewport, src, onLoad, onError]);

  return (
    <div
      ref={containerRef}
      className={`${classes.lazyImageContainer} ${className || ''}`}
      style={{
        aspectRatio,
        backgroundColor: fallbackColor,
        ...style
      }}
      {...props}
    >
      {/* Placeholder con gradiente colorido - ESTADO 2 */}
      <div
        className={`${classes.placeholder} ${!showPlaceholder && imageState === 'loaded' ? classes.hidden : ''}`}
        style={{ background: placeholderBg }}
      >
        {/* Texto indicador para debugging */}
        {imageState === 'loading' && (
          <div className={classes.placeholderText}>
            <span style={{ fontSize: '2rem' }}>🎨</span>
          </div>
        )}
      </div>

      {/* Imagen real con fade-in - ESTADO 3 */}
      {currentSrc && imageState === 'loaded' && (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={classes.image}
          loading="lazy"
          crossOrigin="anonymous"
        />
      )}

      {/* Estado de error */}
      {imageState === 'error' && (
        <div className={classes.errorState}>
          <span className={classes.errorIcon}>📷</span>
        </div>
      )}

      {/* Indicador de carga (shimmer) mientras espera viewport */}
      {imageState === 'loading' && isInViewport && (
        <div className={classes.loadingShimmer} />
      )}
    </div>
  );
}

/**
 * Genera un placeholder colorido basado en el texto
 */
function generatePlaceholder(text) {
  // Generar color basado en hash del texto
  const hash = text.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;

  return `linear-gradient(135deg, 
    hsl(${h1}, 50%, 25%) 0%, 
    hsl(${h2}, 60%, 35%) 50%,
    hsl(${h1}, 45%, 30%) 100%)`;
}

/**
 * Hook para generar tiny placeholder base64 (blur-up)
 * Para usar con el backend que genera thumbnails
 * @deprecated Mover a un archivo separado si se necesita
 */
// export function useTinyPlaceholder(url) {
//   const [tinyUrl, setTinyUrl] = useState(null);
//   useEffect(() => {
//     if (!url) return;
//     // Si el backend soporta tiny thumbnails:
//     // const tiny = url.replace(/\.(webp|jpg|png)$/i, '-tiny.$1');
//     // setTinyUrl(tiny);
//   }, [url]);
//   return tinyUrl;
// }
