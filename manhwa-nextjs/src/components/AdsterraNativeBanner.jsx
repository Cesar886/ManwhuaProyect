'use client';

import { useEffect, useRef } from 'react';

const AD_CONTAINER_ID = 'container-72b3b145adb1b54525609f8133622419';

const adStyles = `
  /* ===== Wrapper: se integra como una sección más del sitio ===== */
  .ad-native-section {
    max-width: 900px;
    width: 100%;
    margin: 2rem auto;
    padding: 0 1rem;
    box-sizing: border-box;
  }

  .ad-native-section .ad-native-card {
    background: var(--card-bg-solid, rgba(24, 24, 32, 0.85));
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    border-radius: 1rem;
    padding: 1rem;
    overflow: hidden;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: box-shadow 0.3s ease, border-color 0.3s ease;
  }

  .ad-native-section .ad-native-card:hover {
    border-color: var(--border-hover, rgba(99, 102, 241, 0.25));
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.08), 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* ===== Adsterra injected content: force single-row grid ===== */
  .ad-native-card #${AD_CONTAINER_ID} {
    width: 100%;
    overflow: hidden;
  }

  /* Main container and row wrappers */
  .ad-native-card #${AD_CONTAINER_ID} > div,
  .ad-native-card #${AD_CONTAINER_ID} > div > div {
    display: grid !important;
    grid-template-columns: repeat(4, 1fr) !important;
    gap: 0.75rem !important;
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    background: transparent !important;
    border: none !important;
  }

  /* Each ad item */
  .ad-native-card #${AD_CONTAINER_ID} > div > div > * {
    min-width: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    box-sizing: border-box !important;
    border-radius: 0.75rem !important;
    overflow: hidden !important;
    background: var(--card-bg-hover, rgba(32, 32, 42, 0.6)) !important;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06)) !important;
    transition: transform 0.25s ease, box-shadow 0.25s ease !important;
    padding: 0.5rem !important;
  }

  .ad-native-card #${AD_CONTAINER_ID} > div > div > *:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
    border-color: var(--border-hover, rgba(99, 102, 241, 0.2)) !important;
  }

  /* Images: rounded, responsive */
  .ad-native-card #${AD_CONTAINER_ID} img {
    max-width: 100% !important;
    width: 100% !important;
    height: auto !important;
    object-fit: cover !important;
    border-radius: 0.5rem !important;
    display: block !important;
  }

  /* Links: inherit site colors */
  .ad-native-card #${AD_CONTAINER_ID} a {
    color: var(--text-primary, #FFFFFF) !important;
    text-decoration: none !important;
    font-family: var(--font-outfit), 'Outfit', sans-serif !important;
  }

  /* Titles */
  .ad-native-card #${AD_CONTAINER_ID} a > div:first-child,
  .ad-native-card #${AD_CONTAINER_ID} .native-ad-title,
  .ad-native-card #${AD_CONTAINER_ID} strong,
  .ad-native-card #${AD_CONTAINER_ID} b {
    font-family: var(--font-outfit), 'Outfit', sans-serif !important;
    font-weight: 600 !important;
    font-size: 0.8rem !important;
    line-height: 1.3 !important;
    color: var(--text-primary, #FFFFFF) !important;
    margin-top: 0.4rem !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  /* Descriptions / secondary text */
  .ad-native-card #${AD_CONTAINER_ID} span,
  .ad-native-card #${AD_CONTAINER_ID} p,
  .ad-native-card #${AD_CONTAINER_ID} .native-ad-body {
    font-family: var(--font-outfit), 'Outfit', sans-serif !important;
    font-weight: 400 !important;
    font-size: 0.7rem !important;
    line-height: 1.3 !important;
    color: var(--text-secondary, #9CA3AF) !important;
    display: -webkit-box !important;
    -webkit-line-clamp: 2 !important;
    -webkit-box-orient: vertical !important;
    overflow: hidden !important;
  }

  /* Hide "Ad" badges or branding from Adsterra if any */
  .ad-native-card #${AD_CONTAINER_ID} [class*="brand"],
  .ad-native-card #${AD_CONTAINER_ID} [class*="sponsored"] {
    font-size: 0.6rem !important;
    opacity: 0.4 !important;
  }

  /* ===== Tablet ===== */
  @media (max-width: 768px) {
    .ad-native-section {
      padding: 0 0.75rem;
      margin: 1.5rem auto;
    }

    .ad-native-section .ad-native-card {
      padding: 0.75rem;
      border-radius: 0.75rem;
    }

    .ad-native-card #${AD_CONTAINER_ID} > div,
    .ad-native-card #${AD_CONTAINER_ID} > div > div {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 0.5rem !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} > div > div > * {
      padding: 0.4rem !important;
      border-radius: 0.5rem !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} strong,
    .ad-native-card #${AD_CONTAINER_ID} b,
    .ad-native-card #${AD_CONTAINER_ID} a > div:first-child {
      font-size: 0.7rem !important;
      -webkit-line-clamp: 2 !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} span,
    .ad-native-card #${AD_CONTAINER_ID} p {
      font-size: 0.6rem !important;
      -webkit-line-clamp: 1 !important;
    }
  }

  /* ===== Mobile ===== */
  @media (max-width: 480px) {
    .ad-native-section {
      padding: 0 0.5rem;
      margin: 1rem auto;
    }

    .ad-native-section .ad-native-card {
      padding: 0.5rem;
    }

    .ad-native-card #${AD_CONTAINER_ID} > div,
    .ad-native-card #${AD_CONTAINER_ID} > div > div {
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 0.35rem !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} > div > div > * {
      padding: 0.3rem !important;
      border-radius: 0.4rem !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} img {
      border-radius: 0.35rem !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} strong,
    .ad-native-card #${AD_CONTAINER_ID} b,
    .ad-native-card #${AD_CONTAINER_ID} a > div:first-child {
      font-size: 0.65rem !important;
      -webkit-line-clamp: 2 !important;
      margin-top: 0.25rem !important;
    }

    .ad-native-card #${AD_CONTAINER_ID} span,
    .ad-native-card #${AD_CONTAINER_ID} p {
      font-size: 0.55rem !important;
      -webkit-line-clamp: 1 !important;
    }
  }

  /* ===== Light mode support ===== */
  [data-mantine-color-scheme="light"] .ad-native-section .ad-native-card {
    background: rgba(255, 255, 255, 0.85);
    border-color: rgba(0, 0, 0, 0.08);
  }

  [data-mantine-color-scheme="light"] .ad-native-section .ad-native-card:hover {
    border-color: rgba(99, 102, 241, 0.3);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.1), 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  [data-mantine-color-scheme="light"] .ad-native-card #${AD_CONTAINER_ID} > div > div > * {
    background: rgba(0, 0, 0, 0.03) !important;
    border-color: rgba(0, 0, 0, 0.06) !important;
  }

  [data-mantine-color-scheme="light"] .ad-native-card #${AD_CONTAINER_ID} a {
    color: #1a1a28 !important;
  }

  [data-mantine-color-scheme="light"] .ad-native-card #${AD_CONTAINER_ID} strong,
  [data-mantine-color-scheme="light"] .ad-native-card #${AD_CONTAINER_ID} b {
    color: #1a1a28 !important;
  }

  [data-mantine-color-scheme="light"] .ad-native-card #${AD_CONTAINER_ID} span,
  [data-mantine-color-scheme="light"] .ad-native-card #${AD_CONTAINER_ID} p {
    color: #6B7280 !important;
  }
`;

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
    <section className="ad-native-section">
      <style>{adStyles}</style>
      <div className="ad-native-card">
        <div id={AD_CONTAINER_ID} ref={containerRef} />
      </div>
    </section>
  );
}
