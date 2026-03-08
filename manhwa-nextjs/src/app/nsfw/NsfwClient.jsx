'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { normalizeImageUrl } from '../../utils/imageUtils';
import ManhwaCover from '../../components/ManhwaCover';
import Header from '@/components/Header';
import { useIA } from '@/hooks/useIA';
import { endpoint } from '../../config';
import { isAdultSeries as isAdultSeriesCentral, hasAvailableChapters, isTruthyAdultFlag } from '@/utils/adultContent';
import { IconFlame, IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, IconArrowLeft } from '@tabler/icons-react';
import { Group, Center, Stack, Modal, Button } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import classes from '../biblioteca/Biblioteca.module.css';

const ChatIA = dynamic(() => import('../../components/ia-minicpm'), { ssr: false });
const Donacion = dynamic(() => import('../../components/Donacion'), { ssr: false });

const API_KEY = process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '';
const NSFW_AGE_CONFIRMED_KEY = 'nsfw_age_confirmed';
const NSFW_FETCH_LIMIT = 100;

const placeholderNsfw = [
  'Manhwas +18 con buena trama',
  'Romance adulto sin censura',
  'Historias ecchi con fantasía oscura',
  'Smut con protagonista dominante',
  'Series +18 populares esta semana',
  'Manhwa adulto similar a Secret Class',
  'Drama adulto con arte de calidad',
];

// Usar la utilidad centralizada para detección de contenido adulto
const isAdultSeries = isAdultSeriesCentral;

const hasAdultFlagTrue = (s) => {
  if (!s || typeof s !== 'object') return false;
  return isTruthyAdultFlag(s.isAdult) || isTruthyAdultFlag(s.is_adult);
};

const resolveSeriesSlug = (item) => {
  if (!item || typeof item !== 'object') return null;
  
  const candidates = [
    item?.slug,
    item?.seriesSlug,
    item?.series_slug,
    item?.slugUrl,
    item?.slug_url,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
};

const normalizeSlugKey = (value) => {
  if (!value || typeof value !== 'string') return '';
  
  const raw = value.trim().toLowerCase();
  if (!raw) return '';

  const withoutQuery = raw.split('?')[0].split('#')[0];
  const noTrailingSlash = withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
  const parts = noTrailingSlash.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
};

const normalizeTitleKey = (value) => {
  if (!value || typeof value !== 'string') return '';
  
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const sanitizeIAExplanation = (value) => {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
};

const normalizeSearchIntent = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/^manhwas?\s*\+?18\s*similares?\s+a\s+/i, '')
    .replace(/^similares?\s+a\s+/i, '')
    .replace(/^similar\s+to\s+/i, '')
    .replace(/^like\s+/i, '')
    .replace(/^recomiend(?:a|ame)\s+/i, '')
    .replace(/^busca(?:r)?\s+/i, '')
    .replace(/^manhwas?\s*\+?18\s+/i, '')
    .replace(/["'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || raw;
};

const normalizeLooseText = (value) => {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const SEARCH_STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'a', 'en', 'del', 'al', 'para', 'con', 'por',
  'similares', 'similar', 'similare', 'manhwa', 'manhwas', 'adulto', 'adulta', 'adultos', 'adultas'
]);

const tokenizeSearch = (value) => {
  return normalizeLooseText(value)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !SEARCH_STOPWORDS.has(word));
};

const getCoverSources = (item) => {
  const primary = normalizeImageUrl(item?.cover || item?.coverUrl || item?.cover_url || item?.coverUrlWeb || item?.cover_url_web) || '';
  const fallback = normalizeImageUrl(item?.coverUrlWeb || item?.cover_url_web || item?.coverUrl || item?.cover_url) || '';
  return { primary, fallback };
};

const toSafeSeriesArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object' && typeof item.title === 'string' && item.title.trim());
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTablet = useMediaQuery('(max-width: 1024px)');
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [hasMounted, setHasMounted] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [series, setSeries] = useState(() => toSafeSeriesArray(initialSeries));
  const [loading, setLoading] = useState(false);
  const [iaSearchLoading, setIaSearchLoading] = useState(false);
  const [iaResults, setIaResults] = useState(null); // null = sin búsqueda activa
  const [iaExplanation, setIaExplanation] = useState('');
  const [initialIAInput, setInitialIAInput] = useState('');
  const [iaSessionKey, setIaSessionKey] = useState(0);
  const [page, setPage] = useState(1);
  const [navigatingToIA, setNavigatingToIA] = useState(false);
  const [donacionOpen, setDonacionOpen] = useState(false);
  const autoIaQueryRunRef = useRef('');
  const gridTopRef = useRef(null);
  const ITEMS_PER_PAGE = 32;
  const { buscarConIACached } = useIA({ namespace: 'nsfw', promptProtection: true });
  const querySearch = null; // No hay búsqueda de título en /nsfw (solo IA)
  const iaViewActive = iaSearchLoading || iaResults !== null || Boolean(iaExplanation);
  const catalogViewActive = !iaViewActive;

  // Solo mostrar series adultas que tengan capítulos disponibles en Spaces
  const adultSeries = useMemo(() => {
    const safeSeries = toSafeSeriesArray(series);
    return safeSeries.filter((item) => isAdultSeries(item) && hasAvailableChapters(item));
  }, [series]);

  const adultCatalogBySlug = useMemo(() => {
    const map = new Map();
    for (const item of adultSeries) {
      const slugKey = normalizeSlugKey(resolveSeriesSlug(item));
      if (slugKey) map.set(slugKey, item);
    }
    return map;
  }, [adultSeries]);

  const adultCatalogById = useMemo(() => {
    const map = new Map();
    for (const item of adultSeries) {
      if (item?.id !== undefined && item?.id !== null) {
        map.set(String(item.id), item);
      }
    }
    return map;
  }, [adultSeries]);

  const adultCatalogByTitle = useMemo(() => {
    const map = new Map();
    for (const item of adultSeries) {
      const titleKey = normalizeTitleKey(item?.title);
      if (titleKey && !map.has(titleKey)) {
        map.set(titleKey, item);
      }
    }
    return map;
  }, [adultSeries]);

  const adultSearchIndex = useMemo(() => {
    return adultSeries
      .map((item) => {
        const title = normalizeLooseText(item?.title || '');
        if (!title) return null;

        const author = normalizeLooseText(item?.author || '');
        const genres = Array.isArray(item?.genres)
          ? item.genres
            .map((genre) => normalizeLooseText(typeof genre === 'string' ? genre : genre?.name || ''))
            .filter(Boolean)
          : [];

        return { item, title, author, genres };
      })
      .filter(Boolean);
  }, [adultSeries]);

  const paginatedSeries = useMemo(() => {
    const safeSeries = Array.isArray(adultSeries) ? adultSeries : [];
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return safeSeries.slice(start, start + ITEMS_PER_PAGE);
  }, [adultSeries, page]);

  const paginatedSeriesCards = useMemo(() => {
    const source = Array.isArray(paginatedSeries) ? paginatedSeries : [];
    return source.map((item) => {
      const itemSlug = resolveSeriesSlug(item);
      const { primary, fallback } = getCoverSources(item);
      return {
        key: itemSlug || item.id,
        item,
        itemSlug,
        primary,
        fallback,
      };
    });
  }, [paginatedSeries]);

  const iaResultCards = useMemo(() => {
    if (!Array.isArray(iaResults)) return [];
    return iaResults.map((item) => {
      const itemSlug = resolveSeriesSlug(item);
      const { primary, fallback } = getCoverSources(item);
      return {
        key: itemSlug || item.id,
        item,
        itemSlug,
        primary,
        fallback,
      };
    });
  }, [iaResults]);

  const totalPages = Math.ceil((Array.isArray(adultSeries) ? adultSeries.length : 0) / ITEMS_PER_PAGE);

  const incomingIAQuery = useMemo(() => {
    const raw = searchParams?.get('ia') || '';
    return sanitizeIAExplanation(raw).slice(0, 160);
  }, [searchParams]);

  useEffect(() => {
    if (!incomingIAQuery) return;
    setInitialIAInput(incomingIAQuery);
  }, [incomingIAQuery]);

  const handlePageChange = useCallback((p) => {
    setPage(p);
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const resetIASearch = useCallback(() => {
    setIaSearchLoading(false);
    setIaResults(null);
    setIaExplanation('');
    setNavigatingToIA(false);
    setPage(1);
    setIaSessionKey((prev) => prev + 1);
    router.replace('/nsfw', { scroll: false });
    gridTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [router]);

  const handleIASearch = useCallback(async (pregunta) => {
    if (!pregunta?.trim()) return;
    const rawQuery = pregunta.trim();
    const query = normalizeSearchIntent(rawQuery) || rawQuery;
    const queryNorm = normalizeLooseText(query);
    const queryTerms = tokenizeSearch(query);
    const hasUsableQuery = Boolean(queryNorm) && queryTerms.length > 0;

    setIaSearchLoading(true);
    setIaResults(null);
    setIaExplanation('');
    
    try {
      // 1. Búsqueda por coincidencia de título
      const titleMatches = adultSearchIndex
        .map((entry) => {
          const { item, title, author, genres } = entry;

          let score = 0;
          if (hasUsableQuery && title.includes(queryNorm)) score += 8;
          if (hasUsableQuery && queryNorm.includes(title) && title.length > 4) score += 3;

          for (const term of queryTerms) {
            if (title.includes(term)) score += 1;
            if (author && author.includes(term)) score += 0.5;
            if (genres.some((genre) => genre.includes(term))) score += 0.5;
          }

          if (!hasUsableQuery && item?.isHot) score += 1;
          if (!hasUsableQuery && Number(item?.views || 0) > 1000) score += 1;

          return score > 0 ? { item, score: Number(score) } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 15)
        .map((entry) => entry.item); // Limitar resultados de título

      // 2. Búsqueda por IA con timeouts y validación
      let iaResults = [];
      let explanation = '';
      try {
        const data = await Promise.race([
          buscarConIACached(query),
          new Promise((_, reject) => setTimeout(() => reject(new Error('IA timeout')), 10000))
        ]);

        // Validar estructura de respuesta
        if (!data || typeof data !== 'object') {
          console.warn('[NSFW] IA respuesta inválida:', data);
          throw new Error('Respuesta de IA inválida');
        }

        // Extraer series con validación
        const rawSeries = data?.series;
        if (!Array.isArray(rawSeries) || rawSeries.length === 0) {
          console.warn('[NSFW] IA no retornó series válidas');
          iaResults = [];
        } else {
          // Validar y enriquecer cada item de IA
          iaResults = rawSeries
            .filter((item) => item && typeof item === 'object')
            .map((item) => {
              // Validar campos mínimos
              if (!item.title || typeof item.title !== 'string') return null;
              
              const slugKey = normalizeSlugKey(resolveSeriesSlug(item));
              const idKey = item?.id !== undefined && item?.id !== null ? String(item.id) : '';
              const titleKey = normalizeTitleKey(item.title);

              // Buscar coincidencia en catálogo local
              const catalogMatch =
                (slugKey && adultCatalogBySlug.has(slugKey) ? adultCatalogBySlug.get(slugKey) : null) ||
                (idKey && adultCatalogById.has(idKey) ? adultCatalogById.get(idKey) : null) ||
                (titleKey && adultCatalogByTitle.has(titleKey) ? adultCatalogByTitle.get(titleKey) : null);

              // Solo aceptar si existe en catálogo adulto confirmado
              if (!catalogMatch) {
                console.warn(`[NSFW] IA resultado no encontrado en catálogo: "${item.title}"`);
                return null;
              }

              // Validar que sea realmente adulto
              if (!hasAdultFlagTrue(catalogMatch) && !isAdultSeries(catalogMatch)) {
                console.warn(`[NSFW] Resultado no es adulto confirmado: "${item.title}"`);
                return null;
              }

              return {
                ...catalogMatch,
                ...item,
                slug: resolveSeriesSlug(item) || resolveSeriesSlug(catalogMatch) || item?.slug || catalogMatch?.slug,
              };
            })
            .filter(Boolean);
        }

        explanation = sanitizeIAExplanation(data?.explanation || '');
      } catch (error) {
        console.warn('[NSFW] Error en búsqueda IA:', error.message);
        iaResults = [];
        explanation = '';
      }

      // 3. Fallback: filtrar por géneros adultos si IA no retorna resultados
      let finalResults = [...titleMatches];
      if (iaResults.length > 0) {
        finalResults.push(...iaResults);
      } else if (titleMatches.length === 0) {
        // Si no hay título coincidente ni IA, buscar por géneros relacionados
        const genreKeywords = queryTerms;
        const genreMatches = adultSearchIndex
          .filter(({ genres }) => genres.some((gname) => genreKeywords.some((k) => gname.includes(k))))
          .slice(0, 10)
          .map(({ item }) => item);
        
        if (genreMatches.length > 0) {
          finalResults.push(...genreMatches);
          explanation = 'Resultados por género relacionado al catálogo +18.';
        }
      }

      // 4. Deduplicar resultados finales
      const deduped = [];
      const seen = new Set();
      for (const item of finalResults) {
        if (!item || typeof item !== 'object') continue;
        
        const slugKey = resolveSeriesSlug(item);
        const key = normalizeSlugKey(slugKey) || 
                    (item?.id !== undefined && item?.id !== null ? `id:${item.id}` : null) ||
                    `title:${normalizeTitleKey(item?.title)}`;
        
        if (!key || seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }

      let finalDeduped = deduped;
      if (finalDeduped.length === 0) {
        finalDeduped = [...adultSeries]
          .sort((a, b) => {
            const hotA = a?.isHot ? 1 : 0;
            const hotB = b?.isHot ? 1 : 0;
            if (hotA !== hotB) return hotB - hotA;
            const viewsA = Number(a?.views || 0);
            const viewsB = Number(b?.views || 0);
            return viewsB - viewsA;
          })
          .slice(0, 12);
      }

      setIaResults(finalDeduped.length > 0 ? finalDeduped : []);
      
      // Establecer explicación apropiada
      if (iaResults.length > 0) {
        setIaExplanation(explanation || 'Resultados basados en búsqueda de IA en el catálogo +18.');
      } else if (titleMatches.length > 0) {
        setIaExplanation('Resultados por coincidencia de título en el catálogo +18.');
      } else if (deduped.length > 0) {
        setIaExplanation('Resultados por género relacionado en el catálogo +18.');
      } else if (finalDeduped.length > 0) {
        setIaExplanation('No hubo coincidencias exactas; mostrando recomendaciones +18 populares del catálogo.');
      } else {
        setIaExplanation('');
      }
      
      console.log(`[NSFW] Búsqueda completada: ${finalDeduped.length} resultados (IA: ${iaResults.length}, Título: ${titleMatches.length})`);
    } catch (error) {
      console.error('[NSFW] Error general en búsqueda:', error);
      setIaResults([]);
      setIaExplanation('');
    } finally {
      setIaSearchLoading(false);
    }
  }, [adultCatalogById, adultCatalogBySlug, adultCatalogByTitle, adultSeries, adultSearchIndex, buscarConIACached]);

  // Carga client-side si no hubo datos SSR
  // Usa /spaces/manhwas que tiene chapterCount real de DigitalOcean Spaces
  const loadMore = useCallback(async () => {
    if (series.length > 0) return;
    setLoading(true);
    try {
      const url = endpoint('spaces', 'manhwas');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const result = await res.json().catch(() => null);
      if (!result || typeof result !== 'object') {
        console.warn('[NSFW] Respuesta de servidor con estructura inválida');
        return;
      }

      const seriesData = toSafeSeriesArray(result.data?.series || result.series || []);

      // Filtrar solo adultas con capítulos disponibles en Spaces
      const validSeries = seriesData.filter((s) =>
        s && typeof s === 'object' && s.title && isAdultSeries(s) && hasAvailableChapters(s)
      );

      setSeries(validSeries);
    } catch (error) {
      console.error('[NSFW] Error cargando series:', error.message);
    } finally {
      setLoading(false);
    }
  }, [series.length]);

  useEffect(() => {
    setHasMounted(true);
    try {
      const stored = window.sessionStorage?.getItem(NSFW_AGE_CONFIRMED_KEY);
      if (stored === 'true') {
        setConfirmed(true);
      }
    } catch (error) {
      console.warn('[NSFW] Error accediendo localStorage:', error.message);
      // Continuar sin guardar estado
    }
  }, []);

  useEffect(() => {
    if (!confirmed || series.length > 0) return;
    loadMore();
  }, [confirmed, loadMore, series.length]);

  useEffect(() => {
    if (!hasMounted || !confirmed) return;
    try {
      window.sessionStorage?.setItem(NSFW_AGE_CONFIRMED_KEY, 'true');
    } catch (error) {
      console.warn('[NSFW] Error guardando confirmación en localStorage:', error.message);
      // Continuar sin guardar - sesión seguirá funcionando
    }
  }, [hasMounted, confirmed]);

  useEffect(() => {
    if (!hasMounted || !confirmed) return;
    if (!incomingIAQuery) return;
    if (autoIaQueryRunRef.current === incomingIAQuery) return;
    if (adultSeries.length === 0) return;

    autoIaQueryRunRef.current = incomingIAQuery;
    setNavigatingToIA(true);
    handleIASearch(incomingIAQuery).finally(() => {
      router.replace('/nsfw', { scroll: false });
    });
  }, [hasMounted, confirmed, incomingIAQuery, adultSeries.length, handleIASearch, router]);

  if (!hasMounted) return null;

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
              onClick={() => {
                try {
                  window.sessionStorage?.setItem(NSFW_AGE_CONFIRMED_KEY, 'true');
                } catch (error) {
                  console.warn('[NSFW] Error guardando confirmación:', error.message);
                }
                setConfirmed(true);
                if (series.length === 0) loadMore();
              }}
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
        marginTop: isMobile ? '6rem' : (isTablet ? '6.6rem' : '7rem'),
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
            top: isMobile ? '1rem' : '1.1rem',
            left: isMobile ? '0.5rem' : '0.65rem',
            pointerEvents: 'none',
            zIndex: 1,
            color: 'rgba(220, 38, 38, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'nsfw-flame-float 3s ease-in-out infinite',
          }}>
            <IconFlame size={isMobile ? 18 : 20} stroke={2} />
          </div>
          <style>{`
            @keyframes nsfw-flame-float {
              0%, 100% { transform: scale(1); opacity: 0.9; }
              33%       { transform: scale(1.08); opacity: 1; }
              66%       { transform: scale(1.04); opacity: 0.95; }
            }
          `}</style>

          <Stack gap="md">
            <ChatIA
              key={`nsfw-ia-${iaSessionKey}`}
              onSearch={handleIASearch}
              loading={iaSearchLoading}
              explanation={iaExplanation || null}
              initialQuery={initialIAInput}
              incognitoMode={true}
              placeholderPhrases={placeholderNsfw}
              onClear={(iaResults !== null || iaSearchLoading || iaExplanation) ? resetIASearch : null}
            />
          </Stack>

          {iaViewActive && (
            <Group mt={4} mb={2}>
              <Button
                variant="subtle"
                color="cyan"
                size="compact-sm"
                leftSection={<IconArrowLeft size={16} />}
                onClick={resetIASearch}
              >
                Volver al catálogo
              </Button>
            </Group>
          )}

          <button
          style={{ marginTop: '1rem'}}
              className={classes.paypalSupport}
              onClick={() => setDonacionOpen(true)}
          >
              <div className={classes.paypalIconWrap}>
                  <svg width="13" height="13" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42c-.03.19-.065.383-.105.578-1.128 5.794-4.96 8.043-9.86 8.043H9.07a.641.641 0 0 0-.633.741l.922 5.84c.066.42.432.727.856.727h3.655c.463 0 .855-.335.927-.791l.038-.198.734-4.653.047-.257c.072-.456.464-.792.927-.792h.583c3.78 0 6.738-1.535 7.603-5.978.362-1.856.175-3.407-.782-4.5a3.72 3.72 0 0 0-1.75-.76z" fill="currentColor" />
                  </svg>
              </div>
              <span className={classes.paypalLabel}>¿Te gusta la IA? Apóyanos para mantenerla</span>
              <span className={classes.paypalCta}>Donar</span>
          </button>

          <Modal
              opened={donacionOpen}
              onClose={() => setDonacionOpen(false)}
              withCloseButton
              centered
              size={380}
              padding={0}
              radius="lg"
              trapFocus={false}
              overlayProps={{ blur: 4, backgroundOpacity: 0.55 }}
              styles={{
                  header: {
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      background: 'transparent',
                      zIndex: 10,
                      minHeight: 'unset',
                      padding: 0,
                  },
                  close: {
                      color: 'var(--text-muted)',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      width: 28,
                      height: 28,
                      '&:hover': {
                          background: 'rgba(255,255,255,0.12)',
                          color: '#fff',
                      },
                  },
                  body: {
                      padding: 0,
                      overflowY: 'auto',
                      maxHeight: 'min(88dvh, 680px)',
                  },
                  content: {
                      background: 'var(--modal-bg, rgba(15,15,20,0.98))',
                      border: '1px solid var(--border-medium, rgba(255,255,255,0.12))',
                      boxShadow: 'var(--shadow-xl), 0 0 60px rgba(var(--imperial-blue-rgb),0.12)',
                      overflow: 'visible',
                  },
              }}
          >
              <Donacion />
          </Modal>
        </div>

        {/* Resultados inline de búsqueda IA (solo adultos) */}
        {iaResults !== null && (
          <div style={{ marginTop: '2.8rem', marginBottom: '1.5rem' }}>
            {iaResults.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 0' }}>
                No se encontraron resultados +18 para tu búsqueda.
              </p>
            ) : (
              <div className={classes.gridReleases}>
                {iaResultCards.map(({ key, item, itemSlug, primary, fallback }, index) => {
                  return (
                  <div key={key || `ia-${index}`} className={classes.releaseCard}>
                    {itemSlug ? (
                    <Link href={`/nsfw/${itemSlug}`} className={classes.releaseCoverContainer}>
                      <div className={classes.releaseCoverWrapper}>
                        <ManhwaCover
                          src={primary}
                          fallbackSrc={fallback}
                          slug={itemSlug}
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
                    ) : (
                    <div className={classes.releaseCoverContainer} aria-disabled="true">
                      <div className={classes.releaseCoverWrapper}>
                        <ManhwaCover
                          src={primary}
                          fallbackSrc={fallback}
                          slug={itemSlug || undefined}
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
                    </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        )}

        {/* Mostrar aviso solo cuando no hay búsqueda IA activa */}
        {catalogViewActive && (
          <div style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: isMobile ? 'stretch' : 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}>
          </div>
        )}

        {catalogViewActive && (loading || adultSeries.length === 0) && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
            {loading
              ? 'Cargando contenido adulto...'
              : 'No hay contenido adulto disponible por el momento.'}
          </p>
        )}

        {/* Grid */}
        {catalogViewActive && !loading && paginatedSeriesCards.length > 0 && (
          <>
            <div ref={gridTopRef} className={classes.gridReleases}>
              {paginatedSeriesCards.map(({ key, item, itemSlug, primary, fallback }, index) => {
                return (
                <div key={key || `grid-${index}`} className={classes.releaseCard}>
                  {itemSlug ? (
                  <Link href={`/nsfw/${itemSlug}`} className={classes.releaseCoverContainer}>
                    <div className={classes.releaseCoverWrapper}>
                      {(item.chapterCount || item.totalChapters) > 0 && (
                        <span className={classes.chapterBadge}>
                          {item.chapterCount || item.totalChapters} caps
                        </span>
                      )}
                      <ManhwaCover
                        src={primary}
                        fallbackSrc={fallback}
                        slug={itemSlug}
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
                  ) : (
                  <div className={classes.releaseCoverContainer} aria-disabled="true">
                    <div className={classes.releaseCoverWrapper}>
                      {(item.chapterCount || item.totalChapters) > 0 && (
                        <span className={classes.chapterBadge}>
                          {item.chapterCount || item.totalChapters} caps
                        </span>
                      )}
                      <ManhwaCover
                        src={primary}
                        fallbackSrc={fallback}
                        slug={itemSlug || undefined}
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
                  </div>
                  )}
                </div>
              )})}
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
