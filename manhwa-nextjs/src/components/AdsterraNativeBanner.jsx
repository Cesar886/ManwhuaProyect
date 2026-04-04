'use client';

import { useEffect, useRef, useState } from 'react';

const AD_KEY = '280fe1a5410d7ce5594949258d04c1ed';

export default function AdsterraNativeBanner({ instanceId = 'default', loadDelayMs = 0 }) {
  const slotRef = useRef(null);
  const [ready, setReady] = useState(loadDelayMs <= 0);
  const containerId = `container-${AD_KEY}-${instanceId}`;

  useEffect(() => {
    if (loadDelayMs <= 0) return undefined;

    const timeoutId = setTimeout(() => setReady(true), loadDelayMs);
    return () => clearTimeout(timeoutId);
  }, [loadDelayMs]);

  useEffect(() => {
    if (!ready) return undefined;

    const slot = slotRef.current;
    if (!slot) return undefined;

    slot.innerHTML = '';

    window.atOptions = {
      key: AD_KEY,
      format: 'iframe',
      height: 60,
      width: 468,
      params: {},
    };

    const configScript = document.createElement('script');
    configScript.type = 'text/javascript';
    configScript.innerHTML = `var atOptions = window.atOptions;`;

    const invokeScript = document.createElement('script');
    invokeScript.src = `https://landslidegraphsystems.com/${AD_KEY}/invoke.js`;
    invokeScript.async = true;
    invokeScript.setAttribute('data-cfasync', 'false');

    slot.appendChild(configScript);
    slot.appendChild(invokeScript);

    return () => {
      slot.innerHTML = '';
      if (typeof window !== 'undefined' && window.atOptions && window.atOptions.key === AD_KEY) {
        delete window.atOptions;
      }
    };
  }, [ready]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0', minHeight: '60px' }}>
      <div
        ref={slotRef}
        id={containerId}
        style={{ width: '100%', maxWidth: '468px', minHeight: '60px', overflow: 'hidden' }}
        aria-label="Publicidad"
      />
    </div>
  );
}
