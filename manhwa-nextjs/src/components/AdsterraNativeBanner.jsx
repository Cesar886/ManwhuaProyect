'use client';

import { useEffect, useRef } from 'react';

export default function AdsterraNativeBanner() {
  const containerRef = useRef(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current || !containerRef.current) return;
    loaded.current = true;

    const script = document.createElement('script');
    script.src = 'https://pl28961764.profitablecpmratenetwork.com/72b3b145adb1b54525609f8133622419/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    containerRef.current.parentNode.insertBefore(script, containerRef.current.nextSibling);
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '1.5rem auto', padding: '0 1rem' }}>
      <div id="container-72b3b145adb1b54525609f8133622419" ref={containerRef} />
    </div>
  );
}
