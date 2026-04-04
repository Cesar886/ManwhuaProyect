'use client';

import { useEffect, useRef, useState } from 'react';

const AD_KEY = '280fe1a5410d7ce5594949258d04c1ed';

export default function AdsterraBannerDisplay({
  instanceId = 'default',
  loadDelayMs = 0,
  deferUntilVisible = false,
}) {
  const slotRef = useRef(null);
  const [delayReady, setDelayReady] = useState(loadDelayMs <= 0);
  const [visibleReady, setVisibleReady] = useState(!deferUntilVisible);
  const ready = delayReady && visibleReady;
  const containerId = `container-${AD_KEY}-${instanceId}`;

  useEffect(() => {
    if (loadDelayMs <= 0) return undefined;

    const timeoutId = setTimeout(() => setDelayReady(true), loadDelayMs);
    return () => clearTimeout(timeoutId);
  }, [loadDelayMs]);

  useEffect(() => {
    if (!deferUntilVisible) return undefined;

    const slot = slotRef.current;
    if (!slot) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry && entry.isIntersecting) {
          setVisibleReady(true);
          observer.disconnect();
        }
      },
      {
        root: null,
        rootMargin: '220px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(slot);

    return () => observer.disconnect();
  }, [deferUntilVisible]);

  useEffect(() => {
    if (!ready) return undefined;

    const slot = slotRef.current;
    if (!slot) return undefined;

    let retryTimeoutId;

    const updateSlotWidth = () => {
      const availableWidth = slot.parentElement?.clientWidth || 468;
      const nextWidth = Math.max(320, Math.min(468, Math.floor(availableWidth)));
      slot.style.width = '100%';
      slot.style.maxWidth = `${nextWidth}px`;
    };

    updateSlotWidth();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateSlotWidth)
      : null;

    if (resizeObserver && slot.parentElement) {
      resizeObserver.observe(slot.parentElement);
    }

    window.addEventListener('resize', updateSlotWidth);

    const mountAd = (attempt = 0) => {
      slot.innerHTML = '';

      window.atOptions = {
        key: AD_KEY,
        format: 'iframe',
        height: 60,
        width: Math.max(320, Math.min(468, Math.floor(slot.parentElement?.clientWidth || 468))),
        params: {},
      };

      const script = document.createElement('script');
      const cacheBuster = attempt > 0 ? `?v=${Date.now()}-${attempt}` : '';
      script.src = `https://landslidegraphsystems.com/${AD_KEY}/invoke.js${cacheBuster}`;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      slot.appendChild(script);

      retryTimeoutId = window.setTimeout(() => {
        const hasIframe = Boolean(slot.querySelector('iframe'));
        if (!hasIframe && attempt < 2) {
          mountAd(attempt + 1);
        }
      }, 1400);
    };

    mountAd(0);

    return () => {
      window.removeEventListener('resize', updateSlotWidth);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      slot.innerHTML = '';
      if (window.atOptions && window.atOptions.key === AD_KEY) {
        delete window.atOptions;
      }
    };
  }, [ready]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0', minHeight: '60px', width: '100%' }}>
      <div
        ref={slotRef}
        id={containerId}
        style={{ width: '100%', maxWidth: '100%', minHeight: '60px', overflow: 'hidden' }}
        aria-label="Publicidad"
      />
    </div>
  );
}
