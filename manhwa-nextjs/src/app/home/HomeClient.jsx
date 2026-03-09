'use client'

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import {
  IconClock,
  IconEye,
  IconTrendingUp,
  IconTrophy,
  IconSparkles,
  IconRefresh,
  IconBook,
  IconDiamond,  IconFlame,} from '@tabler/icons-react';
import { PremiumSkeletonGrid } from '../../components/PremiumSkeleton';
import ManhwaCover from '../../components/ManhwaCover';
import styles from './Home.module.css';
import { normalizeImageUrl } from '../../utils/imageUtils';
import { endpoint } from '../../config';
import Header from '@/components/Header';
import { SEO_CONTENT, getImageAlt, getAnchorText } from '@/lib/seo/constants';
import { slugifyQuery } from '@/hooks/useIA';
import { filterAvailableSeries } from '@/utils/adultContent';

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''

const formatCount = (n) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n ?? 0);
};

// ============================================================================
// COMPONENTE CLIENTE - Recibe datos iniciales del Server Component (SSR)
// Si no hay datos iniciales, los carga client-side como fallback
// ============================================================================

export default function HomeClient({ initialSeries = [] }) {
  const [series, setSeries] = useState(initialSeries)
  const [loading, setLoading] = useState(initialSeries.length === 0)
  const [error, setError] = useState(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const [popularCategories, setPopularCategories] = useState([])
  const [popularLoading, setPopularLoading] = useState(true)

  // Solo carga client-side si el server no pudo proveer datos (fallback)
  useEffect(() => {
    if (initialSeries.length > 0) return

    let cancelled = false
    const load = async () => {
      try {
        const url = endpoint('spaces', 'manhwas')
        const res = await fetch(url, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'max-age=300',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const result = await res.json()
        const data = result.data?.series || result.series || []
        if (!cancelled) {
          // Preservar covers de initialSeries si el fetch no los trae
          const initMap = new Map(initialSeries.map(s => [s.slug, s]))
          const merged = data.map(s => {
            const hasAnyCover = s.coverUrlWeb || s.cover_url_web || s.coverUrl || s.cover_url || s.cover
            if (hasAnyCover) return s
            const init = initMap.get(s.slug)
            if (!init) return s
            return {
              ...s,
              cover:         s.cover         || init.cover,
              coverUrl:      s.coverUrl      || init.coverUrl,
              cover_url:     s.cover_url     || init.cover_url,
              coverUrlWeb:   s.coverUrlWeb   || init.coverUrlWeb,
              cover_url_web: s.cover_url_web || init.cover_url_web,
            }
          })
          setSeries(merged)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cargar queries populares via API route del servidor (caché compartido server-side)
  // El servidor gestiona las llamadas a la IA — el cliente solo hace 1 request
  useEffect(() => {
    let cancelled = false
    const loadPopular = async () => {
      try {
        setPopularLoading(true)
        const res = await fetch('/api/popular-home', {
          headers: { 'Accept': 'application/json' },
        })
        if (!res.ok || cancelled) return
        const { data } = await res.json()
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setPopularCategories(data)
        }
      } catch {
        // Silencioso — la sección simplemente no aparece
      } finally {
        if (!cancelled) setPopularLoading(false)
      }
    }
    loadPopular()
    return () => { cancelled = true }
  }, [])


  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const url = endpoint('spaces', 'manhwas?refresh=true')
      const res = await fetch(url, {
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const result = await res.json()
      setSeries(result.data?.series || result.series || [])
      setIsFromCache(false)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Mostrar skeleton mientras se cargan los datos (solo si no hubo datos SSR)
  if (loading && series.length === 0) {
    return (
      <div className={styles.pageWrapper}>
        <main className={styles.content}>
          {/* H1 SEO incluso durante la carga */}
          <h1 className={styles.seoH1}>{SEO_CONTENT.home.h1}</h1>

          <section>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <IconTrendingUp size={22} />
              </div>
              <h2 className={styles.sectionTitle}>{SEO_CONTENT.home.sections.popular}</h2>
            </div>
            <div className={styles.cardsRow}>
              <PremiumSkeletonGrid count={12} />
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <IconClock size={22} />
              </div>
              <h2 className={styles.sectionTitle}>{SEO_CONTENT.home.sections.latest}</h2>
            </div>
            <div className={styles.gridReleases}>
              <PremiumSkeletonGrid count={6} />
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <main className={styles.content}>
        <Header title="Inicio" />

        {/* ================================================================== */}
        {/* SEO: H1 PRINCIPAL - Keyword "Leer Manhwa en Español Online Gratis" */}
        {/* ================================================================== */}
        <h1 className={styles.seoH1}>{SEO_CONTENT.home.h1}</h1>

        {/* ================================================================== */}
        {/* SEO: PÁRRAFO INTRODUCTORIO CON KEYWORDS NATURALES */}
        {/* ================================================================== */}
        <p className={styles.seoIntro}>
          {SEO_CONTENT.home.introText}
        </p>

        {isFromCache && (
          <div className={styles.cacheNotice}>
            <button
              onClick={refresh}
              disabled={loading}
              className={styles.inlineBtn}
            >
              <IconRefresh size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Actualizando...' : 'Actualizar contenido'}
            </button>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        )}

        {/* ================================================================== */}
        {/* MANHWAS DESTACADOS - SEO: "Manhwas Populares en Español" */}
        {/* ================================================================== */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <IconSparkles size={22} />
            </div>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.home.sections.collection}
            </h2>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              fontWeight: 500
            }}>
              {series.length} Titulos disponibles
            </span>
          </div>

          <div className={styles.cardsRow}>
            {filterAvailableSeries(series).slice(0, 12).map((series, index) => (
              <Link
                href={`/manhwa/${series.slug}`}
                key={series.slug}
                className={styles.popularItem}
                title={getAnchorText.title(series.title)}
              >
                <div className={styles.popularCard}>
                  <ManhwaCover
                    src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url || series.coverUrlWeb || series.cover_url_web) || ''}
                    fallbackSrc={normalizeImageUrl(series.coverUrlWeb || series.cover_url_web || series.cover || series.coverUrl || series.cover_url) || ''}
                    slug={series.slug}
                    alt={getImageAlt.cover(series.title)}
                    className={styles.popularImg}
                    priority={index < 4}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 160px"
                  />
                  {series.chapterCount > 0 && (
                    <span className={styles.chapterBadge}>
                      {series.chapterCount} caps
                    </span>
                  )}
                  <span className={styles.statusBadge}>
                    {series.contentType || series.content_type || 'Manhwa'}
                  </span>
                  <h3 className={styles.titleLink}>{series.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ================================================================== */}
        {/* BÚSQUEDAS POPULARES - Filas Netflix-style (cargado client-side) */}
        {/* ================================================================== */}
        {popularLoading && popularCategories.length === 0 && (
          <section className={styles.querySection}>
            {Array.from({ length: 3 }, (_, rowIdx) => (
              <div key={rowIdx} className={styles.queryRow}>
                <div className={styles.queryHeader}>
                  <div style={{
                    height: '1.25rem',
                    width: '12rem',
                    borderRadius: '0.375rem',
                    background: 'var(--skeleton-base, rgba(255,255,255,0.06))',
                    backgroundImage: 'linear-gradient(110deg, transparent 25%, var(--skeleton-shimmer, rgba(255,255,255,0.06)) 50%, transparent 75%)',
                    backgroundSize: '300% 100%',
                    animation: 'shimmer 3.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                  }} />
                </div>
                <div className={styles.queryScroll}>
                  <PremiumSkeletonGrid count={6} />
                </div>
              </div>
            ))}
          </section>
        )}
        {popularCategories.length > 0 && (
          <section className={styles.querySection}>

            {popularCategories.map((cat, catIdx) => {
              const slug = slugifyQuery(cat.query);
              return (
                <div key={cat.query} className={styles.queryRow}>
                  <div className={styles.queryHeader}>
                    <h2 className={styles.queryName}>{cat.query}</h2>
                    <Link href={`/busqueda-ia/${slug}`} className={styles.queryLink}>
                      Ver más →
                    </Link>
                  </div>
                  <div className={styles.queryScroll}>
                    {cat.series.filter(s => !isAdultSeries(s)).map((item, i) => (
                      <Link
                        href={`/manhwa/${item.slug}`}
                        key={item.id || item.slug}
                        className={styles.queryItem}
                      >
                        <div className={styles.popularCard}>
                          <ManhwaCover
                            src={normalizeImageUrl(item.cover) || ''}
                            fallbackSrc={normalizeImageUrl(item.cover) || ''}
                            slug={item.slug}
                            alt={getImageAlt.cover(item.title)}
                            className={styles.popularImg}
                            priority={catIdx === 0 && i < 4}
                            sizes="(max-width: 480px) 105px, (max-width: 768px) 120px, 140px"
                          />
                          {item.chapterCount > 0 && (
                            <span className={styles.chapterBadge}>
                              {item.chapterCount} caps
                            </span>
                          )}
                          <span className={styles.statusBadge}>
                            {item.contentType || 'Manhwa'}
                          </span>
                          <h3 className={styles.titleLink}>{item.title}</h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ================================================================== */}
        {/* TIP IA - Banner informativo sobre el buscador inteligente          */}
        {/* ================================================================== */}
        <section className={styles.iaTipBanner}>
          <div className={styles.iaTipIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
            </svg>
          </div>
          <div className={styles.iaTipContent}>
            <p className={styles.iaTipTitle}>No necesitas saber el titulo!</p>
            <p className={styles.iaTipText}>
              Describe lo que recuerdas: el tipo de protagonista, el genero, el ambiente... y la IA lo encuentra.
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
