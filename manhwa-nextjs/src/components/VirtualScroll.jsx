import { useState, useEffect, useRef, useCallback } from 'react';
import classes from './VirtualScroll.module.css';

/**
 * VirtualScroll - Componente de scroll virtualizado para capítulos con muchas imágenes
 * 
 * Solo renderiza las imágenes visibles + buffer, reduciendo uso de memoria
 * Ideal para capítulos con 50+ imágenes
 * 
 * @param {Array} items - Array de URLs de imágenes
 * @param {Function} renderItem - Función que renderiza cada item
 * @param {number} itemHeight - Alto aproximado de cada item (para cálculos)
 * @param {number} overscan - Cuántos items extra renderizar arriba/abajo
 * @param {number} threshold - Umbral de imágenes para activar virtualización
 */
export default function VirtualScroll({
  items = [],
  renderItem,
  itemHeight = 1200,
  overscan = 3,
  threshold = 30,
  onItemsInView,
  className,
  ...props
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef(null);
  const isVirtualized = items.length > threshold;

  // Actualizar altura del contenedor
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Manejar scroll
  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop || window.scrollY);
    }
  }, []);

  useEffect(() => {
    const scrollElement = containerRef.current || window;
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // Calcular rango visible
  const getVisibleRange = useCallback(() => {
    if (!isVirtualized) {
      return { start: 0, end: items.length };
    }

    const viewportHeight = containerHeight || window.innerHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
    );

    return { start: startIndex, end: endIndex };
  }, [items.length, scrollTop, containerHeight, itemHeight, overscan, isVirtualized]);

  const { start, end } = getVisibleRange();
  const visibleItems = items.slice(start, end);

  // Notificar items visibles al padre
  useEffect(() => {
    if (onItemsInView) {
      onItemsInView({ start, end, items: visibleItems });
    }
  }, [start, end, visibleItems, onItemsInView]);

  // Altura total del contenido
  const totalHeight = isVirtualized ? items.length * itemHeight : 'auto';

  // Offset del contenido visible
  const offsetY = isVirtualized ? start * itemHeight : 0;

  if (!isVirtualized) {
    // Modo normal: renderizar todos los items
    return (
      <div ref={containerRef} className={`${classes.container} ${className || ''}`} {...props}>
        {items.map((item, index) => (
          <div key={item.id || index} className={classes.item}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  // Modo virtualizado
  return (
    <div ref={containerRef} className={`${classes.container} ${className || ''}`} {...props}>
      {/* Spacer para mantener altura total */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Contenido visible */}
        <div
          className={classes.virtualContent}
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: 'transform'
          }}
        >
          {visibleItems.map((item, virtualIndex) => {
            const actualIndex = start + virtualIndex;
            return (
              <div
                key={item.id || actualIndex}
                className={classes.item}
                data-index={actualIndex}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

