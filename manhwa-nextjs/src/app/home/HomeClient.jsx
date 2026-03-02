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
  IconDiamond,
} from '@tabler/icons-react';
import { PremiumSkeletonGrid } from '../../components/PremiumSkeleton';
import ManhwaCover from '../../components/ManhwaCover';
import styles from './Home.module.css';
import { normalizeImageUrl } from '../../utils/imageUtils';
import { endpoint } from '../../config';
import Header from '@/components/Header';
import { SEO_CONTENT, getImageAlt, getAnchorText } from '@/lib/seo/constants';
import { slugifyQuery } from '@/hooks/useIA';

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
const AI_BASE_URL = (process.env.NEXT_PUBLIC_AI_API_URL || 'https://ai.manhwaimperial.site/api/read')
    .replace('/api/read', '')

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
          setSeries(data)
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

  // Cargar queries populares client-side via AI API (no bloquea SSR)
  useEffect(() => {
    let cancelled = false
    const loadPopular = async () => {
      try {
        // 1. Obtener queries populares
        const popRes = await fetch(`${AI_BASE_URL}/api/popular?limit=20`, {
          headers: { 'Accept': 'application/json' },
        })
        if (!popRes.ok) return
        const popData = await popRes.json()
        if (!popData.success || !Array.isArray(popData.queries)) return

        const queries = popData.queries.filter(q => q.query && q.query.trim().length > 3)
        if (queries.length === 0) return

        // 2. Buscar series via AI API (búsqueda semántica, en paralelo, max 12)
        const toFetch = queries.slice(0, 12)
        const searchResults = await Promise.all(
          toFetch.map(async (q) => {
            try {
              const res = await fetch(`${AI_BASE_URL}/api/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  messages: [{ role: 'user', content: q.query }],
                }),
              })
              if (!res.ok) return []
              const result = await res.json()
              const series = result.series || []
              return series.slice(0, 15).map(s => ({
                id: s.id,
                title: s.title,
                slug: s.slug,
                cover: s.coverUrl || s.cover_url || '',
                chapterCount: s.chapterCount ?? s.chapter_count ?? 0,
                status: s.status ?? 'ongoing',
              }))
            } catch {
              return []
            }
          })
        )

        if (cancelled) return

        // 3. Armar categorías (solo las que tengan ≥3 resultados), max 8
        const categories = toFetch
          .map((q, i) => ({
            query: q.query,
            count: q.count,
            series: searchResults[i],
          }))
          .filter(cat => cat.series.length >= 3)
          .slice(0, 8)

        setPopularCategories(categories)
      } catch {
        // Silencioso — la sección simplemente no aparece
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
              +2000 títulos
            </span>
          </div>

          <div className={styles.cardsRow}>
            {series.slice(0, 12).map((series, index) => (
              <Link
                href={`/manhwa/${series.slug}`}
                key={series.slug}
                className={styles.popularItem}
                title={getAnchorText.title(series.title)}
              >
                <div className={styles.popularCard}>
                  <ManhwaCover
                    src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
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
                    {series.status || 'ongoing'}
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
                    {cat.series.map((item, i) => (
                      <Link
                        href={`/manhwa/${item.slug}`}
                        key={item.id || item.slug}
                        className={styles.queryItem}
                      >
                        <div className={styles.popularCard}>
                          <ManhwaCover
                            src={normalizeImageUrl(item.cover) || ''}
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
                            {item.status || 'ongoing'}
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
