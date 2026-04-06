'use client'

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconClock,
  IconTrendingUp,
  IconSparkles,
  IconRefresh,
} from '@tabler/icons-react';
import { PremiumSkeletonGrid } from '@/components/PremiumSkeleton';
import ManhwaCover from '@/components/ManhwaCover';
import { isAdultSeries } from '@/utils/adultContent';
import styles from './Home.module.css';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { endpoint } from '@/config';
import Header from '@/components/Header';
import { getImageAlt, getAnchorText } from '@/lib/seo/constants';
import { slugifyQuery, getSearchHistory } from '@/hooks/useIA';
import { filterAvailableSeries } from '@/utils/adultContent';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentProgress } from '@/api/progress';
import AdsterraBannerDisplay from '@/components/AdsterraBannerDisplay';
import { useLang } from '@/hooks/useLang';
import { getLocalizedPath } from '@/utils/i18nRoutes';

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || ''
const HOME_CAROUSEL_FEEDBACK_KEY = 'home_carousel_feedback_v1'
const NO_CLICK_PENALTY_MIN_VIEWS = 3
const PERSONALIZED_ALGO_NAME = 'home_personalized_carousel_v2'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value) => UUID_RE.test(String(value || '').trim())

const TRACK_RECO_IMPRESSION_URL = endpoint('track', 'recommendation-impression')
const TRACK_RECO_CLICK_URL = endpoint('track', 'recommendation-click')
const TRACK_RECO_FEEDBACK_URL = endpoint('track', 'recommendation-feedback-summary')

function readCarouselFeedbackMap() {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(HOME_CAROUSEL_FEEDBACK_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCarouselFeedbackMap(map) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(HOME_CAROUSEL_FEEDBACK_KEY, JSON.stringify(map || {}))
  } catch {
    // ignorar errores de storage para no romper render
  }
}

function carouselFeedbackKey(query) {
  const normalized = String(query || '').trim().toLowerCase()
  if (!normalized) return ''
  return slugifyQuery(normalized)
}

function updateCarouselFeedback(query, updater) {
  const key = carouselFeedbackKey(query)
  if (!key) return null

  const map = readCarouselFeedbackMap()
  const current = map[key] || { views: 0, clicks: 0, lastViewAt: 0, lastClickAt: 0 }
  map[key] = updater(current)
  writeCarouselFeedbackMap(map)
  return map[key]
}

function getPenaltyFactorByFeedback(query, persistentFeedback = null) {
  const key = carouselFeedbackKey(query)
  if (!key) return 1

  const map = readCarouselFeedbackMap()
  const localStats = map[key] || { views: 0, clicks: 0 }

  const persistent = (persistentFeedback && typeof persistentFeedback === 'object')
    ? (persistentFeedback[String(query || '').trim().toLowerCase()] || null)
    : null

  const persistentViews = Math.max(0, Number(persistent?.impressions) || 0)
  const persistentClicks = Math.max(0, Number(persistent?.clicks) || 0)

  const stats = {
    views: Math.max(0, Number(localStats.views) || 0) + persistentViews,
    clicks: Math.max(0, Number(localStats.clicks) || 0) + persistentClicks,
    noClickLast3: Math.max(0, Number(persistent?.noClickLast3) || 0),
    recentSample: Math.max(0, Number(persistent?.recentSample) || 0),
  }

  const views = Math.max(0, Number(stats.views) || 0)
  const clicks = Math.max(0, Number(stats.clicks) || 0)

  if (stats.recentSample >= 3 && stats.noClickLast3 >= 3) return 0.15

  if (views >= NO_CLICK_PENALTY_MIN_VIEWS && clicks === 0) return 0.2

  if (views >= NO_CLICK_PENALTY_MIN_VIEWS) {
    const ctr = clicks / Math.max(1, views)
    if (ctr < 0.08) return 0.55
    if (ctr < 0.15) return 0.75
  }

  return 1
}

function rankRowsWithFeedback(rows, persistentFeedback = null) {
  if (!Array.isArray(rows)) return []

  return rows
    .map((row, idx) => {
      const baseScore = Number(row?.rowScore) || (rows.length - idx)
      const penalty = getPenaltyFactorByFeedback(row?.query, persistentFeedback)
      return {
        ...row,
        _baseScore: baseScore,
        _penalty: penalty,
        _adjustedScore: Number((baseScore * penalty).toFixed(4)),
      }
    })
    .sort((a, b) => b._adjustedScore - a._adjustedScore)
}

function trackCarouselClickEvent({ query, seriesSlug, seriesTitle, position }) {
  const payload = {
    event_name: 'click_on_carousel_item',
    carousel_query: String(query || ''),
    series_slug: String(seriesSlug || ''),
    series_title: String(seriesTitle || ''),
    position: Number(position) || 0,
    timestamp: new Date().toISOString(),
  }

  if (typeof window !== 'undefined') {
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'click_on_carousel_item', {
          carousel_query: payload.carousel_query,
          series_slug: payload.series_slug,
          position: payload.position,
        })
      }

      window.dispatchEvent(new CustomEvent('click_on_carousel_item', { detail: payload }))
    } catch {
      // No-op
    }
  }

}

async function fetchPersistentFeedbackByQuery(queries = []) {
  const normalizedQueries = Array.from(new Set(
    (Array.isArray(queries) ? queries : [])
      .map((q) => String(q || '').trim().toLowerCase())
      .filter(Boolean)
  )).slice(0, 30)

  if (normalizedQueries.length === 0) return {}

  try {
    const url = `${TRACK_RECO_FEEDBACK_URL}?queries=${encodeURIComponent(normalizedQueries.join(','))}`
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    })

    if (!res.ok) return {}
    const json = await res.json().catch(() => ({}))
    return json?.success && json?.feedback && typeof json.feedback === 'object' ? json.feedback : {}
  } catch {
    return {}
  }
}

function sendPersistentRecommendationImpression({ impressionId, seriesId, query, rowType, rowScore, position }) {
  if (!isUuid(seriesId) || !isUuid(impressionId)) return

  const payload = {
    recommendation_impression_id: impressionId,
    recommended_series_id: seriesId,
    algoritmo_origen: PERSONALIZED_ALGO_NAME,
    banner_position: Number(position) || 1,
    mostrado_en: new Date().toISOString(),
    recommendation_context: {
      carousel_query: String(query || '').trim().toLowerCase(),
      carousel_type: String(rowType || 'personalized').trim(),
      row_score: Number(rowScore) || 0,
    },
  }

  fetch(TRACK_RECO_IMPRESSION_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

function sendPersistentRecommendationClick({ impressionId, seriesId }) {
  if (!isUuid(seriesId) || !isUuid(impressionId)) return

  const payload = {
    recommendation_impression_id: impressionId,
    recommended_series_id: seriesId,
    algoritmo_origen: PERSONALIZED_ALGO_NAME,
    clicked_at: new Date().toISOString(),
  }

  fetch(TRACK_RECO_CLICK_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(API_KEY ? { 'x-api-key': API_KEY } : {}) },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {})
}

// ============================================================================
// COMPONENTE CLIENTE - Recibe datos iniciales del Server Component (SSR)
// Si no hay datos iniciales, los carga client-side como fallback
// ============================================================================

export default function HomeClient({ initialSeries = [], lang: propLang }) {
  const { lang: detectedLang, t } = useLang();
  const lang = propLang || detectedLang;
  
  const [series, setSeries] = useState(initialSeries)
  const [loading, setLoading] = useState(initialSeries.length === 0)
  const [error, setError] = useState(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const [popularCategories, setPopularCategories] = useState([])
  const [popularLoading, setPopularLoading] = useState(true)
  const [recentReads, setRecentReads] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [smartRecommendation, setSmartRecommendation] = useState({
    loading: false,
    sourceTitle: '',
    sourceSlug: '',
    aiQuery: '',
    sourceMode: 'daily',
    items: [],
  })
  const [personalizedRows, setPersonalizedRows] = useState([])
  const [personalizedLoading, setPersonalizedLoading] = useState(true)
  const [persistentFeedbackByQuery, setPersistentFeedbackByQuery] = useState({})
  const { user } = useAuth()
  const seenCarouselImpressionsRef = useRef(new Set())
  const seenCarouselItemImpressionsRef = useRef(new Set())
  const impressionIdByItemRef = useRef({})

  const getFeaturedSourceSeries = (seriesList = []) => {
    const availableSeries = filterAvailableSeries(seriesList)
    return availableSeries.find((item) => item?.slug && item?.title) || seriesList.find((item) => item?.slug && item?.title) || null
  }

  const getHistorySourceSeries = (recentList = []) => {
    return recentList.find((item) => item?.series?.slug && item?.series?.title)?.series || null
  }

  const getDailyRotatingSourceSeries = (seriesList = [], date = new Date()) => {
    const availableSeries = filterAvailableSeries(seriesList)
      .filter((item) => item?.slug && item?.title)
      .slice()
      .sort((a, b) => String(a.slug || '').localeCompare(String(b.slug || '')))

    if (availableSeries.length === 0) return null

    const dayKey = date.toISOString().slice(0, 10)
    const seed = dayKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return availableSeries[seed % availableSeries.length]
  }

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
        let data
        try {
          const json = await res.json()
          data = json?.data
        } catch { return }
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

  useEffect(() => {
    let cancelled = false

    if (!user) {
      setRecentReads([])
      setRecentLoading(false)
      return undefined
    }

    const loadRecentReads = async () => {
      setRecentLoading(true)

      try {
        const recent = await getRecentProgress(6)
        const recentList = Array.isArray(recent) ? recent : []

        if (!cancelled) {
          setRecentReads(recentList)
        }
      } catch {
        if (!cancelled) {
          setRecentReads([])
        }
      } finally {
        if (!cancelled) setRecentLoading(false)
      }
    }

    loadRecentReads()

    return () => { cancelled = true }
  }, [user, user?.id])

  useEffect(() => {
    let cancelled = false

    const loadSmartRecommendation = async () => {
      const historySourceSeries = user ? getHistorySourceSeries(recentReads) : null
      const dailySourceSeries = getDailyRotatingSourceSeries(series)
      const sourceSeries = historySourceSeries || dailySourceSeries || getFeaturedSourceSeries(series)

      if (user && recentLoading) {
        setSmartRecommendation((prev) => ({ ...prev, loading: true }))
        return
      }

      if (!sourceSeries?.slug || !sourceSeries?.title) {
        if (!cancelled) {
          setSmartRecommendation({ loading: false, sourceTitle: '', sourceSlug: '', aiQuery: '', sourceMode: 'daily', items: [] })
        }
        return
      }

      setSmartRecommendation(prev => ({ ...prev, loading: true }))

      const sourceTitle = String(sourceSeries.title || '').trim()
      const sourceSlug = String(sourceSeries.slug || '').trim()
      const sourceMode = historySourceSeries ? 'history' : 'daily'
      const aiQuery = sourceTitle ? `manhwas similares a ${sourceTitle}` : ''
      const availableFallback = filterAvailableSeries(series)
        .filter((item) => item?.slug && item.slug !== sourceSlug)
        .slice(0, 8)

      try {
        const aiRes = await fetch(endpoint('search', 'ai/read'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: aiQuery }],
          }),
        })

        let relatedRaw = []

        if (aiRes.ok) {
          try {
            const aiJson = await aiRes.json()
            const aiSeries = Array.isArray(aiJson?.series)
              ? aiJson.series
              : Array.isArray(aiJson?.data?.series)
                ? aiJson.data.series
                : []

            const catalogBySlug = new Map(
              filterAvailableSeries(series)
                .filter((item) => item?.slug)
                .map((item) => [String(item.slug), item])
            )

            relatedRaw = aiSeries.map((item) => {
              const slug = String(item?.slug || '').trim()
              const fallback = slug ? catalogBySlug.get(slug) : null

              return {
                ...item,
                slug: slug || fallback?.slug,
                title: String(item?.title || fallback?.title || '').trim(),
                cover: item?.cover || item?.coverUrl || item?.cover_url || fallback?.cover || fallback?.coverUrl || fallback?.cover_url || fallback?.coverUrlWeb || fallback?.cover_url_web || '',
                chapterCount:
                  item?.chapterCount ??
                  item?.chaptersCount ??
                  item?.chapters_count ??
                  fallback?.chapterCount ??
                  fallback?.chaptersCount ??
                  fallback?.chapters_count ??
                  0,
              }
            })
          } catch {
            relatedRaw = []
          }
        }

        const cleaned = filterAvailableSeries(Array.isArray(relatedRaw) ? relatedRaw : [])
          .filter((item) => item?.slug && item.slug !== sourceSlug)
          .slice(0, 8)

        const items = cleaned.length > 0 ? cleaned : availableFallback

        if (!cancelled) {
          setSmartRecommendation({
            loading: false,
            sourceTitle,
            sourceSlug,
            aiQuery,
            sourceMode,
            items,
          })
        }
      } catch {
        if (!cancelled) {
          setSmartRecommendation({
            loading: false,
            sourceTitle,
            sourceSlug,
            aiQuery,
            sourceMode,
            items: availableFallback,
          })
        }
      }
    }

    loadSmartRecommendation()

    return () => { cancelled = true }
  }, [series, recentReads, recentLoading, user])

  useEffect(() => {
    let cancelled = false

    const loadPersonalizedRows = async () => {
      try {
        setPersonalizedLoading(true)

        const recentHistory = getSearchHistory(8)
        const historyQueries = Array.isArray(recentHistory)
          ? recentHistory
            .map((entry) => ({
              query: String(entry?.query || '').trim(),
              ts: Number(entry?.ts) || Date.now(),
            }))
            .filter((entry) => entry.query)
          : []

        if (historyQueries.length === 0) {
          if (!cancelled) setPersonalizedRows([])
          return
        }

        const res = await fetch('/api/personalized-home', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ history: historyQueries }),
        })

        if (!res.ok || cancelled) return

        const json = await res.json().catch(() => ({}))
        const rows = Array.isArray(json?.data) ? json.data : []

        const queryList = rows.map((row) => String(row?.query || '').trim().toLowerCase()).filter(Boolean)
        const persistentFeedback = await fetchPersistentFeedbackByQuery(queryList)
        const rankedRows = rankRowsWithFeedback(rows, persistentFeedback)

        if (!cancelled) {
          setPersistentFeedbackByQuery(persistentFeedback)
          setPersonalizedRows(rankedRows)
        }
      } catch {
        if (!cancelled) setPersonalizedRows([])
      } finally {
        if (!cancelled) setPersonalizedLoading(false)
      }
    }

    loadPersonalizedRows()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!Array.isArray(personalizedRows) || personalizedRows.length === 0) return

    for (let i = 0; i < personalizedRows.length; i++) {
      const row = personalizedRows[i]
      const query = String(row?.query || '').trim()
      const key = carouselFeedbackKey(query)
      if (!key || seenCarouselImpressionsRef.current.has(key)) continue

      seenCarouselImpressionsRef.current.add(key)
      updateCarouselFeedback(query, (current) => ({
        ...current,
        views: (Number(current.views) || 0) + 1,
        lastViewAt: Date.now(),
      }))
    }
  }, [personalizedRows])

  useEffect(() => {
    if (!Array.isArray(personalizedRows) || personalizedRows.length === 0) return

    for (let rowIdx = 0; rowIdx < personalizedRows.length; rowIdx++) {
      const row = personalizedRows[rowIdx]
      const rowQuery = String(row?.query || '').trim().toLowerCase()
      if (!rowQuery) continue

      const rowSeries = filterAvailableSeries(Array.isArray(row?.series) ? row.series : []).slice(0, 10)

      for (let itemIdx = 0; itemIdx < rowSeries.length; itemIdx++) {
        const item = rowSeries[itemIdx]
        const seriesId = String(item?.id || '').trim()
        if (!isUuid(seriesId)) continue

        const itemKey = `${carouselFeedbackKey(rowQuery)}::${seriesId}`
        if (seenCarouselItemImpressionsRef.current.has(itemKey)) continue
        seenCarouselItemImpressionsRef.current.add(itemKey)

        const impressionId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`

        if (isUuid(impressionId)) {
          impressionIdByItemRef.current[itemKey] = impressionId
          sendPersistentRecommendationImpression({
            impressionId,
            seriesId,
            query: rowQuery,
            rowType: row?.type,
            rowScore: row?._adjustedScore || row?.rowScore,
            position: itemIdx + 1,
          })
        }
      }
    }
  }, [personalizedRows])

  const handlePersonalizedItemClick = useCallback((row, item, itemIndex) => {
    const query = String(row?.query || '').trim()
    if (!query) return

    updateCarouselFeedback(query, (current) => ({
      ...current,
      clicks: (Number(current.clicks) || 0) + 1,
      lastClickAt: Date.now(),
    }))

    trackCarouselClickEvent({
      query,
      seriesSlug: item?.slug,
      seriesTitle: item?.title,
      position: itemIndex + 1,
    })

    const queryKey = carouselFeedbackKey(query.toLowerCase())
    const seriesId = String(item?.id || '').trim()
    const itemKey = `${queryKey}::${seriesId}`

    let knownImpressionId = impressionIdByItemRef.current[itemKey]
    if (isUuid(seriesId) && !isUuid(knownImpressionId)) {
      const fallbackImpressionId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : ''
      if (isUuid(fallbackImpressionId)) {
        knownImpressionId = fallbackImpressionId
        impressionIdByItemRef.current[itemKey] = fallbackImpressionId
        sendPersistentRecommendationImpression({
          impressionId: fallbackImpressionId,
          seriesId,
          query: query.toLowerCase(),
          rowType: row?.type,
          rowScore: row?._adjustedScore || row?.rowScore,
          position: itemIndex + 1,
        })
      }
    }

    if (isUuid(seriesId) && isUuid(knownImpressionId)) {
      sendPersistentRecommendationClick({
        impressionId: knownImpressionId,
        seriesId,
      })
    }

    setPersistentFeedbackByQuery((prev) => ({
      ...prev,
      [String(query || '').trim().toLowerCase()]: {
        ...(prev[String(query || '').trim().toLowerCase()] || {}),
        impressions: Number(prev[String(query || '').trim().toLowerCase()]?.impressions) || 0,
        clicks: (Number(prev[String(query || '').trim().toLowerCase()]?.clicks) || 0) + 1,
      },
    }))
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
          <h1 className={styles.seoH1}>{t.home.h1}</h1>

          <section>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <IconTrendingUp size={22} />
              </div>
              <h2 className={styles.sectionTitle}>{t.home.sections.popular}</h2>
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
              <h2 className={styles.sectionTitle}>{t.home.sections.latest}</h2>
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
        <Header title={lang === 'en' ? 'Home' : 'Inicio'} lang={lang} />

        {/* ================================================================== */}
        {/* SEO: H1 PRINCIPAL - Keyword "Leer Manhwa en Español Online Gratis" */}
        {/* ================================================================== */}
        <h1 className={styles.seoH1}>{t.home.h1}</h1>

        {/* ================================================================== */}
        {/* SEO: PÁRRAFO INTRODUCTORIO CON KEYWORDS NATURALES */}
        {/* ================================================================== */}
        <p className={styles.seoIntro}>
          {t.home.introText}
        </p>

        {isFromCache && (
          <div className={styles.cacheNotice}>
            <button
              onClick={refresh}
              disabled={loading}
              className={styles.inlineBtn}
            >
              <IconRefresh size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? (lang === 'en' ? 'Updating...' : 'Actualizando...') : (lang === 'en' ? 'Refresh content' : 'Actualizar contenido')}
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
              {t.home.sections.collection}
            </h2>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              fontWeight: 500
            }}>
              {series.length} {lang === 'en' ? 'Available titles' : 'Títulos disponibles'}
            </span>
          </div>

          <div className={styles.cardsRow}>
            {(filterAvailableSeries(series) || []).slice(0, 12).map((series, index) => (
              <Link
                href={getLocalizedPath(`/manhwa/${series.slug}`, lang)}
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
                      {series.chapterCount} {lang === 'en' ? 'ch' : 'caps'}
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

        {/* Adsterra Banner Display 468x60 */}
        <AdsterraBannerDisplay />

        {user && recentLoading && (
          <section className={styles.querySection}>
            <div className={styles.queryRow}>
              <div className={styles.queryHeader}>
                <h2 className={styles.queryName}>{t.home.continueReading}</h2>
                <Link href={getLocalizedPath('/perfil', lang)} className={styles.queryLink}>
                  {lang === 'en' ? 'View history' : 'Ver historial'} →
                </Link>
              </div>
              <div className={styles.queryScroll}>
                <PremiumSkeletonGrid count={6} />
              </div>
            </div>
          </section>
        )}

        {user && !recentLoading && recentReads.length > 0 && (
          <section className={styles.querySection}>
            <div className={styles.queryRow}>
              <div className={styles.queryHeader}>
                <h2 className={styles.queryName}>{t.home.continueReading}</h2>
                <Link href={getLocalizedPath('/perfil', lang)} className={styles.queryLink}>
                  {lang === 'en' ? 'View history' : 'Ver historial'} →
                </Link>
              </div>

              <div className={styles.queryScroll}>
                {recentReads.slice(0, 6).map((item, i) => {
                  const slug = item.series?.slug || item.slug || ''
                  const title = item.series?.title || item.title || slug
                  const chapter = item.chapter?.number || item.chapterNum || item.chapter_num || item.latestChapter || item.lastChapter || ''
                  const progress = Math.min(100, Math.max(0, Number(item.progress) || 0))
                  const cover = item.series?.coverUrl || item.series?.cover_url || item.series?.cover || item.coverUrl || item.cover_url || item.cover || ''

                  return (
                    <Link
                      href={slug ? getLocalizedPath(`/manhwa/${slug}`, lang) : '#'}
                      key={`${slug || title}-${i}`}
                      className={styles.queryItem}
                    >
                      <div className={styles.popularCard}>
                        <ManhwaCover
                          src={normalizeImageUrl(cover) || ''}
                          fallbackSrc={normalizeImageUrl(cover) || ''}
                          slug={slug}
                          alt={getImageAlt.cover(title)}
                          className={styles.popularImg}
                          priority={i < 4}
                          sizes="(max-width: 480px) 105px, (max-width: 768px) 120px, 140px"
                        />
                        {chapter && (
                          <span className={styles.chapterBadge}>
                            Cap.{chapter}
                          </span>
                        )}
                        <span className={styles.statusBadge}>
                          {progress > 0 ? `${progress}%` : 'Historia'}
                        </span>
                        <h3 className={styles.titleLink}>{title}</h3>
                        <div style={{ position: 'absolute', left: 8, right: 8, bottom: 8, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--imperial-cyan), var(--imperial-gold))' }} />
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {smartRecommendation.loading && (
          <section className={styles.querySection}>
            <div className={styles.queryRow}>
              <div className={styles.queryHeader}>
                <h2 className={styles.queryName}>{lang === 'en' ? 'Recommendations for you' : 'Recomendaciones para ti'}</h2>
              </div>
              <div className={styles.queryScroll}>
                <PremiumSkeletonGrid count={6} />
              </div>
            </div>
          </section>
        )}

        {personalizedLoading && personalizedRows.length === 0 && (
          <section className={styles.querySection}>
            <div className={styles.queryRow}>
              <div className={styles.queryHeader}>
                <h2 className={styles.queryName}>{lang === 'en' ? 'Personalized for you' : 'Personalizado para ti'}</h2>
              </div>
              <div className={styles.queryScroll}>
                <PremiumSkeletonGrid count={6} />
              </div>
            </div>
          </section>
        )}

        {!personalizedLoading && personalizedRows.length > 0 && (
          <section className={styles.querySection}>
            {personalizedRows.map((row, rowIdx) => {
              const rowQuery = String(row?.query || '').trim()
              const querySlug = rowQuery ? slugifyQuery(rowQuery) : ''
              const rowTitle = String(row?.title || '').trim()
              const rowSubtitle = String(row?.subtitle || '').trim()
              const rowSeries = filterAvailableSeries(Array.isArray(row?.series) ? row.series : [])

              if (!rowTitle || rowSeries.length === 0) return null

              return (
                <div key={`${row.type || 'row'}-${rowIdx}-${querySlug || rowIdx}`} className={styles.queryRow}>
                  <div className={styles.queryHeader}>
                    <div>
                      <h2 className={styles.queryName}>{rowTitle}</h2>
                      {rowSubtitle && (
                        <p style={{ margin: '0.15rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{rowSubtitle}</p>
                      )}
                    </div>
                    {querySlug && (
                      <Link href={getLocalizedPath(`/busqueda-ia/${querySlug}`, lang)} className={styles.queryLink}>
                        {lang === 'en' ? 'See full AI list' : 'Ver lista completa IA'} →
                      </Link>
                    )}
                  </div>

                  <div className={styles.queryScroll}>
                    {rowSeries.slice(0, 10).map((item, i) => (
                      <Link
                        href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}
                        key={item.id || item.slug}
                        className={styles.queryItem}
                        onClick={() => handlePersonalizedItemClick(row, item, i)}
                      >
                        <div className={styles.popularCard}>
                          <ManhwaCover
                            src={normalizeImageUrl(item.coverUrl || item.cover_url || item.cover || item.coverUrlWeb || item.cover_url_web) || ''}
                            fallbackSrc={normalizeImageUrl(item.coverUrlWeb || item.cover_url_web || item.cover || item.coverUrl || item.cover_url) || ''}
                            slug={item.slug}
                            alt={getImageAlt.cover(item.title)}
                            className={styles.popularImg}
                            priority={rowIdx === 0 && i < 4}
                            sizes="(max-width: 480px) 105px, (max-width: 768px) 120px, 140px"
                          />
                          {item.chapterCount > 0 && (
                            <span className={styles.chapterBadge}>
                              {item.chapterCount} {lang === 'en' ? 'ch' : 'caps'}
                            </span>
                          )}
                          <span className={styles.statusBadge}>
                            {item.contentType || item.content_type || 'Manhwa'}
                          </span>
                          <h3 className={styles.titleLink}>{item.title}</h3>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {!smartRecommendation.loading && smartRecommendation.items.length > 0 && (
          <section className={styles.querySection}>
            <div className={styles.queryRow}>
              <div className={styles.queryHeader}>
                <h2 className={styles.queryName}>
                  {smartRecommendation.sourceMode === 'history'
                    ? (lang === 'en'
                      ? `Because you read ${smartRecommendation.sourceTitle}, you may like this`
                      : `Porque leíste ${smartRecommendation.sourceTitle}, te puede gustar esto`)
                    : (lang === 'en'
                      ? `Today you may like this`
                      : `Hoy te puede gustar esto`)}
                </h2>
                <Link href={getLocalizedPath(`/busqueda-ia/${slugifyQuery(smartRecommendation.aiQuery || `manhwas similares a ${smartRecommendation.sourceTitle}`)}`, lang)} className={styles.queryLink}>
                  {lang === 'en' ? 'View AI results' : 'Ver resultados IA'} →
                </Link>
              </div>

              <div className={styles.queryScroll}>
                {smartRecommendation.items.map((item, i) => (
                  <Link
                    href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}
                    key={item.id || item.slug}
                    className={styles.queryItem}
                  >
                    <div className={styles.popularCard}>
                      <ManhwaCover
                        src={normalizeImageUrl(item.coverUrl || item.cover_url || item.cover || item.coverUrlWeb || item.cover_url_web) || ''}
                        fallbackSrc={normalizeImageUrl(item.coverUrlWeb || item.cover_url_web || item.cover || item.coverUrl || item.cover_url) || ''}
                        slug={item.slug}
                        alt={getImageAlt.cover(item.title)}
                        className={styles.popularImg}
                        priority={i < 4}
                        sizes="(max-width: 480px) 105px, (max-width: 768px) 120px, 140px"
                      />
                      {item.chapterCount > 0 && (
                        <span className={styles.chapterBadge}>
                          {item.chapterCount} {lang === 'en' ? 'ch' : 'caps'}
                        </span>
                      )}
                      <span className={styles.statusBadge}>
                        {item.contentType || item.content_type || 'Manhwa'}
                      </span>
                      <h3 className={styles.titleLink}>{item.title}</h3>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

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
                    {/* SEO: Anchor text descriptivo — nunca "Ver más" solo */}
                    <Link href={`/busqueda-ia/${slug}`} className={styles.queryLink}>
                      {lang === 'en' ? `Explore ${cat.query.toLowerCase()} manhwa` : `Explorar manhwas de ${cat.query.toLowerCase()}`} →
                    </Link>
                  </div>
                  <div className={styles.queryScroll}>
                    {(cat.series || []).filter(s => !isAdultSeries(s)).map((item, i) => (
                      <Link
                        href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}
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
                              {item.chapterCount} {lang === 'en' ? 'ch' : 'caps'}
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
        {/* SEO: SECCIÓN "¿QUÉ ES UN MANHWA?" — Contenido educativo con      */}
        {/* keywords long-tail para capturar tráfico informacional             */}
        {/* ================================================================== */}
        <section className={styles.whatIsManhwa}>
          <h2 className={styles.sectionTitle}>{t.home.whatIsManhwa.title}</h2>
          <p className={styles.seoIntro}>{t.home.whatIsManhwa.text}</p>
        </section>

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
            <p className={styles.iaTipTitle}>{t.home.aiTip.title}</p>
            <p className={styles.iaTipText}>
              {t.home.aiTip.text}
            </p>
          </div>
        </section>

      </main>
    </div>
  );
}
