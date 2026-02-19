import { useState, useEffect, useRef, useMemo } from 'react';
import classes from './OptimizedImage.module.css';

/**
 * OptimizedImage - Componente de imagen ultra-optimizado para manhwa
 * 
 * Características:
 * - Lazy loading con Intersection Observer
 * - Progressive loading (low quality → high quality)
 * - Responsive images con srcset
 * - WebP con fallback a JPG
 * - Blur placeholder
 * - Detección automática de viewport/DPR
 * - Preload inteligente de siguientes imágenes
 * 
 * @param {string} src - URL base de la imagen
 * @param {string} alt - Texto alternativo
 * @param {string} blurhash - Hash para placeholder (opcional)
 * @param {number} width - Ancho original de la imagen
 * @param {number} height - Alto original de la imagen
 * @param {number} priority - Índice de prioridad (menor = mayor prioridad)
 * @param {number} preloadOffset - Cuántas imágenes adelante precargar
 * @param {Object} networkConfig - Configuración según velocidad de red
 * @param {Function} onLoad - Callback cuando carga
 * @param {Function} onError - Callback en error
 */
export default function OptimizedImage({
  src,
  alt = '',
  blurhash,
  width,
  height,
  priority = 999,
  preloadOffset = 2,
  networkConfig = {},
  onLoad,
  onError,
  className,
  style,
  ...props
}) {
  const [loadState, setLoadState] = useState('idle'); // idle | loading | loaded | error
  const [currentSrc, setCurrentSrc] = useState(null);
  const [showLowQuality, setShowLowQuality] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const observerRef = useRef(null);

  // Configuración por defecto
  const config = {
    quality: 85,
    maxWidth: 1600,
    format: 'webp',
    preloadCount: 2,
    enableBlur: true,
    ...networkConfig
  };

  // Calcular aspect ratio
  const aspectRatio = useMemo(() => {
    if (width && height) {
      return `${width}/${height}`;
    }
    return '3/4'; // Default para manhwa
  }, [width, height]);

  // Generar URLs optimizadas
  const imageUrls = useMemo(() => {
    if (!src) return null;

    // Detectar si la URL ya tiene parámetros
    const hasParams = src.includes('?');
    const separator = hasParams ? '&' : '?';
    
    // Agregar timestamp para evitar caché
    const timestamp = Date.now();

    // Generar srcset para diferentes tamaños
    const sizes = [400, 800, 1200, 1600];
    const dpr = window.devicePixelRatio || 1;

    // URL de baja calidad para progressive loading
    const lowQuality = `${src}${separator}w=600&q=30&f=${config.format}&t=${timestamp}`;

    // URL de alta calidad basada en configuración de red
    const highQuality = `${src}${separator}w=${config.maxWidth}&q=${config.quality}&f=${config.format}&t=${timestamp}`;

    // Srcset para responsive images
    const srcset = sizes
      .filter(size => size <= config.maxWidth)
      .map(size => {
        const url = `${src}${separator}w=${size}&q=${config.quality}&f=${config.format}&t=${timestamp}`;
        return `${url} ${size}w`;
      })
      .join(', ');

    // Sizes attribute
    const sizesAttr = '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px';

    return {
      lowQuality,
      highQuality,
      srcset,
      sizes: sizesAttr,
      fallbackJpg: `${src}${separator}w=${config.maxWidth}&q=${config.quality}&f=jpg`
    };
  }, [src, config]);

  // Intersection Observer para lazy loading
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Determinar rootMargin basado en prioridad
    let rootMargin = '200px'; // Default
    if (priority < 3) {
      rootMargin = '0px'; // Imágenes prioritarias se cargan inmediatamente
    } else if (priority < preloadOffset + 3) {
      rootMargin = '400px'; // Próximas imágenes se precargan
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(container);
          }
        });
      },
      {
        rootMargin,
        threshold: 0.01
      }
    );

    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [priority, preloadOffset]);

  // Progressive loading: cargar versión de baja calidad primero
  useEffect(() => {
    if (!isInView || !imageUrls) return;
    if (loadState !== 'idle') return;

    setLoadState('loading');

    // Si la conexión es lenta, cargar directamente low quality
    if (config.quality < 70) {
      loadImage(imageUrls.highQuality, false);
      return;
    }

    // Progressive loading: low → high quality
    if (config.enableBlur && priority > 2) {
      loadImage(imageUrls.lowQuality, true);
      
      // Después de 300ms, cargar versión de alta calidad
      const timer = setTimeout(() => {
        loadImage(imageUrls.highQuality, false);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      // Cargar directamente alta calidad para imágenes prioritarias
      loadImage(imageUrls.highQuality, false);
    }
  }, [isInView, imageUrls, loadState, config, priority]);

  // Función para cargar imagen
  const loadImage = (url, isLowQuality) => {
    const img = new Image();

    img.onload = () => {
      if (isLowQuality) {
        setShowLowQuality(true);
        setCurrentSrc(url);
      } else {
        setCurrentSrc(url);
        setShowLowQuality(false);
        setLoadState('loaded');
        onLoad?.();
      }
    };

    img.onerror = () => {
      // Intentar fallback a JPG
      if (url.includes('webp')) {
        loadImage(imageUrls.fallbackJpg, false);
      } else {
        setLoadState('error');
        onError?.();
      }
    };

    img.src = url;
  };

  // Placeholder color basado en blurhash o generado
  const placeholderStyle = useMemo(() => {
    if (blurhash) {
      // Implementar blurhash decode aquí si tienes la librería
      return { backgroundColor: '#1a1a2e' };
    }

    // Generar color basado en src
    const hash = src?.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0) || 0;

    const hue = Math.abs(hash % 360);
    return {
      background: `linear-gradient(135deg, 
        hsl(${hue}, 30%, 15%) 0%, 
        hsl(${(hue + 30) % 360}, 35%, 20%) 100%)`
    };
  }, [blurhash, src]);

  return (
    <div
      ref={containerRef}
      className={`${classes.container} ${className || ''}`}
      style={{
        aspectRatio,
        ...placeholderStyle,
        ...style
      }}
      {...props}
    >
      {/* Placeholder con shimmer effect */}
      {loadState === 'loading' && !currentSrc && (
        <div className={classes.placeholder}>
          <div className={classes.shimmer} />
        </div>
      )}

      {/* Imagen progresiva */}
      {currentSrc && (
        <picture>
          {/* WebP con srcset */}
          {imageUrls?.srcset && (
            <source
              type="image/webp"
              srcSet={imageUrls.srcset}
              sizes={imageUrls.sizes}
            />
          )}

          {/* Fallback JPG */}
          <img
            ref={imgRef}
            src={currentSrc}
            alt={alt}
            className={`${classes.image} ${
              showLowQuality ? classes.lowQuality : classes.highQuality
            }`}
            loading={priority < 3 ? 'eager' : 'lazy'}
            decoding={priority < 3 ? 'sync' : 'async'}
            onLoad={() => {
              if (!showLowQuality) {
                setLoadState('loaded');
                onLoad?.();
              }
            }}
          />
        </picture>
      )}

      {/* Estado de error */}
      {loadState === 'error' && (
        <div className={classes.error}>
          <span className={classes.errorIcon}>📷</span>
          <span className={classes.errorText}>Error al cargar</span>
        </div>
      )}

      {/* Indicador de carga para imágenes prioritarias */}
      {priority < 3 && loadState === 'loading' && (
        <div className={classes.loadingIndicator}>
          <div className={classes.spinner} />
        </div>
      )}
    </div>
  );
}

/**
 * Utilidad para generar URLs de diferentes tamaños
 * Útil para preload manual
 */
export function generateImageUrl(baseSrc, { width, quality = 85, format = 'webp' }) {
  if (!baseSrc) return null;
  const hasParams = baseSrc.includes('?');
  const separator = hasParams ? '&' : '?';
  return `${baseSrc}${separator}w=${width}&q=${quality}&f=${format}`;
}

/**
 * Componente wrapper para imágenes críticas que deben cargarse inmediatamente
 */
export function PriorityImage(props) {
  return <OptimizedImage {...props} priority={0} />;
}
