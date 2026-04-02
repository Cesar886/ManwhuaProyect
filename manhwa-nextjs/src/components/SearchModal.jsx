'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { slugifyQuery } from '@/hooks/useIA';

const ChatIA = dynamic(() => import('@/components/ia-minicpm'), {
  ssr: false,
  loading: () => null,
});

const STYLES = `
  .sm-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: clamp(64px, 10vh, 120px) 1rem 2rem;
    background: rgba(4, 4, 10, 0.78);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: sm-overlay-in 0.2s ease;
  }
  [data-mantine-color-scheme="light"] .sm-overlay {
    background: rgba(15, 15, 30, 0.58);
  }

  .sm-wrapper {
    width: 100%;
    max-width: 680px;
    animation: sm-card-in 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sm-card {
    border-radius: var(--radius-lg);
    background: var(--modal-bg);
    border: 1px solid var(--border-medium);
    box-shadow:
      0 32px 80px rgba(0, 0, 0, 0.55),
      0 0 0 1px rgba(var(--imperial-blue-rgb), 0.12),
      inset 0 1px 0 var(--border-subtle),
      0 0 70px rgba(var(--imperial-blue-rgb), 0.09);
  }
  [data-mantine-color-scheme="light"] .sm-card {
    box-shadow:
      0 20px 60px rgba(26, 26, 40, 0.14),
      0 0 0 1px rgba(var(--imperial-blue-rgb), 0.14),
      0 0 40px rgba(var(--imperial-blue-rgb), 0.07);
  }

  .sm-gradient-bar {
    height: 2px;
    background: var(--gradient-imperial);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  [data-mantine-color-scheme="light"] .sm-gradient-bar {
    opacity: 0.85;
  }

  .sm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 0;
  }

  .sm-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sm-icon {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: var(--gradient-imperial);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 10px rgba(var(--imperial-blue-rgb), 0.45);
  }

  .sm-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
    letter-spacing: 0.01em;
    font-family: var(--font-body);
  }

  .sm-hint {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .sm-kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--subtle-bg);
    border: 1px solid var(--border-medium);
    border-bottom: 2px solid var(--border-strong);
    border-radius: 5px;
    padding: 2px 8px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    user-select: none;
    line-height: 1.6;
  }

  .sm-hint-text {
    font-size: 11px;
    color: var(--text-muted);
    opacity: 0.5;
    user-select: none;
    font-family: var(--font-body);
  }

  .sm-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 10px 20px 0;
  }

  .sm-body {
    padding: 10px 16px 14px;
  }

  .sm-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 6px 20px 12px;
    border-top: 1px solid var(--border-subtle);
  }

  .sm-tip {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10.5px;
    color: var(--text-muted);
    opacity: 0.5;
    user-select: none;
    font-family: var(--font-body);
  }

  .sm-tip-kbd {
    background: var(--subtle-bg);
    border: 1px solid var(--border-subtle);
    border-radius: 4px;
    padding: 0 5px;
    font-size: 10px;
    font-family: var(--font-mono);
    color: var(--text-muted);
    line-height: 1.6;
  }

  @keyframes sm-overlay-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes sm-card-in {
    from { opacity: 0; transform: translateY(-14px) scale(0.975); }
    to   { opacity: 1; transform: translateY(0)     scale(1); }
  }
  @media (prefers-reduced-motion: reduce) {
    .sm-overlay, .sm-wrapper { animation: none; }
  }
`;

export default function SearchModal() {
  const [open, setOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const chatRef = useRef(null);
  const router = useRouter();

  const closeModal = useCallback(() => setOpen(false), []);

  // Ctrl+K / Cmd+K
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, closeModal]);

  // Foco automático al abrir
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => chatRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [open]);

  const handleSearch = useCallback((query) => {
    const slug = slugifyQuery(query);
    setNavigating(true);
    router.push(`/busqueda-ia/${slug}`);
    closeModal();
    setNavigating(false);
  }, [router, closeModal]);

  if (!open) return null;

  return (
    <>
      <style>{STYLES}</style>

      <div
        className="sm-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Buscar manhwa con IA"
        onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      >
        <div className="sm-wrapper">
          <div className="sm-card">

            {/* Barra de gradiente */}
            <div className="sm-gradient-bar" />

            {/* Cabecera */}
            <div className="sm-header">
              <div className="sm-title">
                <div className="sm-icon">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                  </svg>
                </div>
                <span className="sm-label">IA Imperial</span>
              </div>

              <div className="sm-hint">
                <kbd className="sm-kbd">ESC</kbd>
                <span className="sm-hint-text">para cerrar</span>
              </div>
            </div>

            {/* Separador */}
            <div className="sm-divider" />

            {/* Buscador IA */}
            <div className="sm-body">
              <ChatIA
                ref={chatRef}
                onSearch={handleSearch}
                loading={navigating}
              />
            </div>

            {/* Footer con atajos */}
            <div className="sm-footer">
              <span className="sm-tip">
                <kbd className="sm-tip-kbd">↵</kbd>
                buscar
              </span>
              <span className="sm-tip">
                <kbd className="sm-tip-kbd">↑ ↓</kbd>
                navegar
              </span>
              <span className="sm-tip">
                <kbd className="sm-tip-kbd">Ctrl K</kbd>
                abrir / cerrar
              </span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
