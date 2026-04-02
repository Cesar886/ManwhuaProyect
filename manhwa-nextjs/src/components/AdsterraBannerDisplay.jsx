'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraBannerDisplay() {
  const slotRef = useRef(null);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return undefined;

    // Reinicia el contenedor para garantizar una ejecución limpia por mount.
    slot.innerHTML = '';

    window.atOptions = {
      key: '280fe1a5410d7ce5594949258d04c1ed',
      format: 'iframe',
      height: 60,
      width: 468,
      params: {},
    };

    const script = document.createElement('script');
    script.src = 'https://landslidegraphsystems.com/280fe1a5410d7ce5594949258d04c1ed/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    slot.appendChild(script);

    return () => {
      slot.innerHTML = '';
      if (window.atOptions && window.atOptions.key === '280fe1a5410d7ce5594949258d04c1ed') {
        delete window.atOptions;
      }
    };
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0', minHeight: '60px' }}>
      <div
        ref={slotRef}
        style={{ width: '100%', maxWidth: '468px', minHeight: '60px', overflow: 'hidden' }}
        aria-label="Publicidad"
      />
    </div>
  );
}
