'use client';

import { useEffect } from 'react';

const VERTICAL_SWIPE_THRESHOLD = 10;

function isEditableElement(element) {
  if (!(element instanceof Element)) return false;

  return element.matches('input, textarea') ||
    element.isContentEditable ||
    element.closest('[contenteditable="true"]') !== null;
}

export default function MobileKeyboardDismissal() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const coarsePointer = window.matchMedia('(pointer: coarse)');
    if (!coarsePointer.matches) return undefined;

    let startX = 0;
    let startY = 0;
    let startedInsideEditable = false;
    let gestureHandled = false;

    const resetGesture = () => {
      startX = 0;
      startY = 0;
      startedInsideEditable = false;
      gestureHandled = false;
    };

    const handleTouchStart = (event) => {
      if (!coarsePointer.matches || event.touches.length !== 1) {
        resetGesture();
        return;
      }

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startedInsideEditable = isEditableElement(event.target);
      gestureHandled = false;
    };

    const handleTouchMove = (event) => {
      if (
        !coarsePointer.matches ||
        gestureHandled ||
        startedInsideEditable ||
        event.touches.length !== 1
      ) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;

      if (
        Math.abs(deltaY) >= VERTICAL_SWIPE_THRESHOLD &&
        Math.abs(deltaY) > Math.abs(deltaX)
      ) {
        gestureHandled = true;

        const activeElement = document.activeElement;
        if (isEditableElement(activeElement)) {
          activeElement.blur();
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', resetGesture, { passive: true });
    document.addEventListener('touchcancel', resetGesture, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', resetGesture);
      document.removeEventListener('touchcancel', resetGesture);
    };
  }, []);

  return null;
}
