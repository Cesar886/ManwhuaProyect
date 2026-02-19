import { useState, useCallback } from 'react';

/**
 * Hook para usar con VirtualScroll
 * Proporciona información sobre scroll y visibilidad
 */
export function useVirtualScroll({ totalItems, itemHeight = 1200 }) {
  const [scrollInfo, setScrollInfo] = useState({
    scrollTop: 0,
    scrollPercent: 0,
    currentIndex: 0,
    isAtBottom: false,
    isAtTop: true
  });

  const updateScrollInfo = useCallback((scrollTop) => {
    const scrollHeight = totalItems * itemHeight;
    const viewportHeight = window.innerHeight;
    const maxScroll = scrollHeight - viewportHeight;
    
    const scrollPercent = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
    const currentIndex = Math.floor(scrollTop / itemHeight);
    const isAtBottom = scrollTop >= maxScroll - 50;
    const isAtTop = scrollTop < 50;

    setScrollInfo({
      scrollTop,
      scrollPercent,
      currentIndex,
      isAtBottom,
      isAtTop
    });
  }, [totalItems, itemHeight]);

  return { scrollInfo, updateScrollInfo };
}