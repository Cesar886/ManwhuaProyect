'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { normalizeImageUrl } from '../../utils/imageUtils';
import ManhwaCover from '../../components/ManhwaCover';
import Header from '@/components/Header';
import { endpoint } from '../../config';
import { IconFlame, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { Group, Center, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classes from '../biblioteca/Biblioteca.module.css';

const ChatIA = dynamic(() => import('../../components/ia-minicpm'), { ssr: false });

const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read')
  .replace('/api/read', '');

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '';
const NSFW_AGE_CONFIRMED_KEY = 'nsfw_age_confirmed';

const placeholderNsfw = [
  'Manhwas +18 con buena trama',
  'Romance adulto sin censura',
  'Historias ecchi con fantasía oscura',
  'Smut con protagonista dominante',
  'Series +18 populares esta semana',
  'Manhwa adulto similar a Secret Class',
  'Drama adulto con arte de calidad',
];

const isAdultSeries = (s) => {
  if (!s) return false;
  const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
  if (truthy(s.isAdult) || truthy(s.is_adult)) return true;
  return (s.genres || []).some((g) => {
    const name = (typeof g === 'string' ? g : g?.name || '').toLowerCase();
    return name.includes('adult') || name.includes('hentai') || name.includes('ecchi') || name.includes('smut');
  });
};

// Paginación reutilizable
function CustomPagination({ value, onChange, total, color = 'red' }) {
  const isMobile = useMediaQuery('(max-width: 600px)');
  const btnSize = isMobile ? 30 : 36;
  const showPages = isMobile ? 3 : 5;

  const getVisiblePages = () => {
    const pages = [];
    let start = Math.max(1, value - Math.floor(showPages / 2));
    let end = Math.min(total, start + showPages - 1);
    if (end - start + 1 < showPages) start = Math.max(1, end - showPages + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const btnStyle = (isActive) => ({
    minWidth: btnSize, height: btnSize, borderRadius: '50%', border: 'none',
    cursor: 'pointer', fontWeight: isActive ? 600 : 400, fontSize: isMobile ? '0.8rem' : '0.875rem',
    backgroundColor: isActive ? 'rgba(220,38,38,0.85)' : 'transparent',
    color: isActive ? 'white' : 'var(--mantine-color-dimmed)',
    transition: 'all 0.2s ease',
  });

  const navStyle = (disabled) => ({
    minWidth: btnSize, height: btnSize, borderRadius: '50%', border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer', backgroundColor: 'transparent',
    color: disabled ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
    opacity: disabled ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
  });

  const iconSize = isMobile ? 15 : 18;

  return (
    <Group gap={isMobile ? 2 : 4} wrap="nowrap">
      <button style={navStyle(value === 1)} onClick={() => value > 1 && onChange(1)} disabled={value === 1} aria-label="Primera página"><IconChevronsLeft size={iconSize} /></button>
      <button style={navStyle(value === 1)} onClick={() => value > 1 && onChange(value - 1)} disabled={value === 1} aria-label="Página anterior"><IconChevronLeft size={iconSize} /></button>
      {getVisiblePages().map(p => (
        <button key={p} style={btnStyle(p === value)} onClick={() => onChange(p)}>{p}</button>
      ))}
      <button style={navStyle(value === total)} onClick={() => value < total && onChange(value + 1)} disabled={value === total} aria-label="Página siguiente"><IconChevronRight size={iconSize} /></button>
      <button style={navStyle(value === total)} onClick={() => value < total && onChange(total)} disabled={value === total} aria-label="Última página"><IconChevronsRight size={iconSize} /></button>
    </Group>
  );
}

export default function NsfwClient({ initialSeries = [] }) {
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [confirmed, setConfirmed] = useState(false);
  const [series, setSeries] = useState(initialSeries);
  const [loading, setLoading] = useState(false);
  const [iaSearchLoading, setIaSearchLoading] = useState(false);
  const [iaResults, setIaResults] = useState(null); // null = sin búsqueda activa
  const [iaExplanation, setIaExplanation] = useState('');
  const [page, setPage] = useState(1);
  const gridTopRef = useRef(null);
  const ITEMS_PER_PAGE = 32;

  // Solo mostrar series que sean realmente adultas
  const adultSeries = useMemo(() =>
    series.filter(s => isAdultSeries(s)),
    [series]
  );

  const totalPages = Math.ceil(adultSeries.length / ITEMS_PER_PAGE);

  const paginatedSeries = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return adultSeries.slice(start, start + ITEMS_PER_PAGE);
  }, [adultSeries, page]);

  const handlePageChange = useCallback((p) => {
    setPage(p);
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleIASearch = useCallback(async (pregunta) => {
    if (!pregunta?.trim()) return;
    setIaSearchLoading(true);
    setIaResults(null);
    setIaExplanation('');
    try {
      const res = await fetch(`${AI_BASE_URL}/api/read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Skip-History': 'true',
        },
        body: JSON.stringify({ messages: [{ role: 'user', content: pregunta }] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setIaResults(data.series || []);
      setIaExplanation(data.explanation || '');
    } catch {
      setIaResults([]);
    } finally {
      setIaSearchLoading(false);
    }
  }, []);

  // Carga client-side si no hubo datos SSR
  const loadMore = useCallback(async () => {
    if (series.length > 0) return;
    setLoading(true);
    try {
      const url = endpoint('series') + '?adult=only&limit=100&sort=updated_at&order=desc';
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      });
      if (!res.ok) return;
      const result = await res.json();
      setSeries(result.data?.series || result.series || []);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, [series.length]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NSFW_AGE_CONFIRMED_KEY);
      if (stored === 'true') {
        setConfirmed(true);
        if (series.length === 0) loadMore();
      }
    } catch {
      // silencioso
    }
  }, [loadMore, series.length]);

  useEffect(() => {
    if (!confirmed) return;
    try {
      window.localStorage.setItem(NSFW_AGE_CONFIRMED_KEY, 'true');
    } catch {
      // silencioso
    }
  }, [confirmed]);

  // ── Pantalla de verificación de edad ──────────────────────────────────────
  if (!confirmed) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--page-bg, #0a0a0f)', padding: isMobile ? '1rem' : '2rem',
      }}>
        <div style={{
          maxWidth: isMobile ? '100%' : 420, width: '100%', textAlign: 'center',
          background: 'rgba(220,38,38,0.06)',
          border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: isMobile ? 14 : 16,
          padding: isMobile ? '1.8rem 1.2rem' : '2.5rem 2rem',
          boxShadow: '0 0 60px rgba(220,38,38,0.08)',
        }}>
          <div style={{ fontSize: isMobile ? '2.4rem' : '3rem', marginBottom: isMobile ? '0.8rem' : '1rem' }}>🔞</div>
          <h1 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 600, color: '#fff', marginBottom: '0.5rem' }}>
            Contenido para Adultos
          </h1>
          <p style={{ color: 'var(--text-muted, #9ca3af)', fontSize: isMobile ? '0.875rem' : '0.925rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
            Esta sección contiene material de contenido maduro (+18).
            Al continuar confirmas que eres mayor de edad según la legislación de tu país.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => { setConfirmed(true); if (series.length === 0) loadMore(); }}
              style={{
                background: 'linear-gradient(135deg, rgba(220,38,38,0.9) 0%, rgba(185,28,28,0.9) 100%)',
                color: '#fff', border: 'none', borderRadius: 10, padding: '0.75rem 1.5rem',
                fontWeight: 700, fontSize: isMobile ? '0.95rem' : '1rem', cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(220,38,38,0.3)',
              }}
            >
              Soy mayor de 18 años — Entrar
            </button>
            <Link href="/" style={{
              color: 'var(--text-muted, #9ca3af)', fontSize: '0.875rem', textDecoration: 'none',
            }}>
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Contenido principal ────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--page-bg, #0a0a0f)' }}>
      <div style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: isMobile ? '0 0.75rem' : (isTablet ? '0 1rem' : '0 1.25rem'),
        marginTop: isMobile ? '4.25rem' : (isTablet ? '4.6rem' : '5rem'),
      }}>
        <Header />

        {/* IA Search — sin historial ni slug, resultados inline */}
        <div id="nsfw-ia-wrap" style={{ position: 'relative' }}>
          {/* Estilos scoped: reemplaza estrella por llama y colorea de rojo */}
          <style>{`
            #nsfw-ia-wrap .ia-icon {
              opacity: 0 !important;
              animation: none !important;
            }
            #nsfw-ia-wrap .ia-search::after {
              background: rgba(220, 38, 38, 0.5) !important;
            }
            #nsfw-ia-wrap .ia-shimmer {
              background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(220, 38, 38, 0.95) 30%,
                rgba(255, 90, 90, 1) 50%,
                rgba(220, 38, 38, 0.95) 70%,
                transparent 100%
              ) !important;
            }
            #nsfw-ia-wrap .ia-dots span {
              background: rgba(220, 38, 38, 0.9) !important;
            }
            #nsfw-ia-wrap .ia-input {
              caret-color: rgba(220, 38, 38, 0.9) !important;
              padding-left: 0.45rem !important;
            }
            #nsfw-ia-wrap .ia-input::placeholder {
              color: rgba(220, 38, 38, 0.45) !important;
            }
            #nsfw-ia-wrap .ia-suggestions::before {
              background: linear-gradient(
                90deg,
                rgba(220, 38, 38, 0.9) 0%,
                rgba(255, 90, 90, 1) 50%,
                rgba(220, 38, 38, 0.9) 100%
              ) !important;
            }
            #nsfw-ia-wrap .ia-suggestion-item:hover,
            #nsfw-ia-wrap .ia-suggestion-item:focus {
              background: rgba(220, 38, 38, 0.08) !important;
            }
            #nsfw-ia-wrap .ia-submit {
              color: rgba(220, 38, 38, 0.85) !important;
            }
            #nsfw-ia-wrap .ia-submit:hover {
              color: rgba(220, 38, 38, 1) !important;
              background: rgba(220, 38, 38, 0.1) !important;
            }

            @media (max-width: 1024px) {
              #nsfw-ia-wrap .ia-search {
                padding: 0.65rem 0.75rem !important;
              }
            }

            @media (max-width: 768px) {
              #nsfw-ia-wrap .ia-search {
                padding: 0.6rem 0.65rem !important;
              }

              #nsfw-ia-wrap .ia-input {
                font-size: 16px !important;
                padding-left: 0.65rem !important;
              }
            }
          `}</style>

          {/* IconFlame superpuesto sobre el .ia-icon invisible */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: isMobile ? '0.5rem' : '0.65rem',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            zIndex: 2,
            color: 'rgba(220, 38, 38, 0.9)',
            display: 'flex',
            alignItems: 'center',
            animation: 'nsfw-flame-float 3s ease-in-out infinite',
          }}>
            <IconFlame size={isMobile ? 18 : 20} stroke={2} />
          </div>
          <style>{`
            @keyframes nsfw-flame-float {
              0%, 100% { transform: translateY(-50%) scale(1);    opacity: 0.9; }
              33%       { transform: translateY(calc(-50% - 3px)) scale(1.08); opacity: 1;   }
              66%       { transform: translateY(calc(-50% - 1px)) scale(1.04); opacity: 0.95; }
            }
          `}</style>

          <Stack gap="md">
            <ChatIA
                onSearch={handleIASearch}
                loading={iaSearchLoading}
                explanation={iaExplanation || null}
                incognitoMode={true}
              placeholderPhrases={placeholderNsfw}
                onClear={iaResults !== null ? () => { setIaResults(null); setIaExplanation(''); } : null}
            />
          </Stack>
        </div>

        {/* Resultados inline de búsqueda IA (solo adultos) */}
        {iaResults !== null && (
          <div style={{ marginBottom: '1.5rem' }}>
            {iaResults.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
                No se encontraron resultados +18 para tu búsqueda.
              </p>
            ) : (
              <div className={classes.gridReleases}>
                {iaResults.filter(s => isAdultSeries(s)).map((item, index) => (
                  <div key={item.slug || item.id} className={classes.releaseCard}>
                    <Link href={`/manhwa/${item.slug}`} className={classes.releaseCoverContainer}>
                      <div className={classes.releaseCoverWrapper}>
                        <ManhwaCover
                          src={normalizeImageUrl(item.cover || item.coverUrl || item.cover_url || item.coverUrlWeb || item.cover_url_web) || ''}
                          fallbackSrc={normalizeImageUrl(item.coverUrlWeb || item.cover_url_web || item.coverUrl || item.cover_url) || ''}
                          slug={item.slug}
                          alt={`Portada ${item.title} - Contenido +18`}
                          className={classes.popularImg}
                          priority={index < 8}
                          sizes="(max-width: 480px) 45vw, (max-width: 768px) 30vw, (max-width: 1200px) 22vw, 200px"
                        />
                        <span className={classes.adultBadge}>
                          <IconFlame size={11} stroke={2.5} />
                          +18
                        </span>
                        <div className={classes.releaseOverlay}>
                          <h3 className={classes.releaseTitle}>{item.title}</h3>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}>
          {/* Aviso discreto */}
          <div style={{
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 10,
            padding: '0.6rem 1rem',
            fontSize: '0.8rem',
            color: 'rgba(220,38,38,0.85)',
            display: 'flex',
            gap: '0.45rem',
            alignItems: 'center',
            lineHeight: 1.35,
            flex: isMobile ? '1 1 100%' : '1 1 auto',
          }}>
            <span aria-hidden="true">🔞</span>
            <span>Solo para mayores de 18 años.  Aqui no se guarda el historial, modo incognito</span>
          </div>

          <span style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted, #9ca3af)',
            whiteSpace: 'nowrap',
            padding: '0.45rem 0.65rem',
            borderRadius: 8,
            border: '1px solid rgba(156,163,175,0.2)',
            background: 'rgba(255,255,255,0.02)',
            alignSelf: isMobile ? 'flex-end' : 'auto',
          }}>
            {adultSeries.length} títulos
          </span>
        </div>

        {(loading || adultSeries.length === 0) && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
            {loading
              ? 'Cargando contenido adulto...'
              : 'No hay contenido adulto disponible por el momento.'}
          </p>
        )}

        {/* Grid */}
        {!loading && paginatedSeries.length > 0 && (
          <>
            <div ref={gridTopRef} className={classes.gridReleases}>
              {paginatedSeries.map((item, index) => (
                <div key={item.slug || item.id} className={classes.releaseCard}>
                  <Link href={`/manhwa/${item.slug}`} className={classes.releaseCoverContainer}>
                    <div className={classes.releaseCoverWrapper}>
                      {(item.chapterCount || item.totalChapters) > 0 && (
                        <span className={classes.chapterBadge}>
                          {item.chapterCount || item.totalChapters} caps
                        </span>
                      )}
                      <ManhwaCover
                        src={normalizeImageUrl(item.cover || item.coverUrl || item.cover_url || item.coverUrlWeb || item.cover_url_web) || ''}
                        fallbackSrc={normalizeImageUrl(item.coverUrlWeb || item.cover_url_web || item.coverUrl || item.cover_url) || ''}
                        slug={item.slug}
                        alt={`Portada ${item.title} - Contenido +18`}
                        className={classes.popularImg}
                        priority={index < 8}
                        sizes="(max-width: 480px) 45vw, (max-width: 768px) 30vw, (max-width: 1200px) 22vw, 200px"
                      />
                      <span className={classes.adultBadge}>
                        <IconFlame size={11} stroke={2.5} />
                        +18
                      </span>
                      <div className={classes.releaseOverlay}>
                        <h3 className={classes.releaseTitle}>{item.title}</h3>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <Center mt="xl" mb="xl">
                <CustomPagination
                  value={page}
                  onChange={handlePageChange}
                  total={totalPages}
                  color="red"
                />
              </Center>
            )}
          </>
        )}
      </div>
    </div>
  );
}
