"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import useImageQueue from '@/hooks/useImageQueue';
import { useNetworkQuality, getQueueConfig } from '@/hooks/useNetworkQuality';
import useNextChapterPrefetch from '@/hooks/useNextChapterPrefetch';
import ChapterImage from '@/components/ChapterImage';

import dynamic from 'next/dynamic';
import { useChapterPages, useSeriesDetail } from '@/hooks/useSpaces';
import ChapterNavigation from '@/components/ChapterNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateChapterRequest } from '@/api/requests';
import ReaderHeader from '@/components/ReaderHeader';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import ReadingProgressBar from '@/components/ReadingProgressBar';
import ChapterRating from '@/components/ChapterRating';
import AdsterraBannerDisplay from '@/components/AdsterraBannerDisplay';
import Script from 'next/script';
import { Avatar, Group, Text, Tooltip } from '@mantine/core';
import { useChapterReaders } from '@/hooks/useChapterReaders';

// Carga dinámica para evitar que el CSS de Mantine sea preloaded innecesariamente
const Comentarios = dynamic(() => import('@/components/Comentarios'), { ssr: false });
const LoginModal = dynamic(() => import('@/components/LoginModal'), { ssr: false });
// import ReadingRestoredNotice from '@/components/ReadingRestoredNotice';

// Wrapper para estabilizar el objeto detailRequest y evitar re-renders infinitos
function ComentariosWrapper({ chapterRequest, slug, chapterNum, openLogin, user, lang = 'es' }) {
  const detailRequest = useMemo(() => ({
    type: 'request',
    targetType: 'request',
    id: chapterRequest.id,
    targetId: chapterRequest.id,
    title: chapterRequest.title || `${slug.replace(/-/g, ' ')} - ${lang === 'en' ? 'Chapter' : 'Capítulo'} ${chapterNum}`,
    slug: slug,
    chapterNum: chapterNum
  }), [chapterRequest.id, chapterRequest.title, slug, chapterNum, lang]);


  return (
    <Comentarios
      detailRequest={detailRequest}
      openLogin={openLogin}
      user={user}
      refetch={() => { }}
    />
  );
}

/**
 * Lector de capítulos desde DigitalOcean Spaces
 *
 * Props:
 *   initialPages    - imágenes pre-cargadas en el servidor (SSR), para que
 *                     crawlers sin JS vean el capítulo completo en el HTML inicial.
 *   initialSeries   - datos de la serie pre-cargados en el servidor (SSR).
 */
export default function ChapterReader({ initialPages = [], initialSeries = null, seriesBasePath = '/manhwa', lang = 'es' }) {
  const chapterSegment = lang === 'en' ? 'chapter' : 'capitulo';
  const params = useParams();
  const slug = params?.slug;
  const paramChapterNum = params?.numero;

  // Estado local del capítulo — permite navegación instantánea sin pasar por Next.js router
  const [chapterNum, setChapterNum] = useState(paramChapterNum);

  // Sincronizar si cambia desde fuera (navegación del browser, Link de ChapterNavigation, etc.)
  useEffect(() => {
    if (paramChapterNum && paramChapterNum !== chapterNum) {
      setChapterNum(paramChapterNum);
    }
  }, [paramChapterNum]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escuchar popstate para back/forward del navegador
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(new RegExp(`/${chapterSegment}/([^/]+)`));
      if (match?.[1] && match[1] !== chapterNum) {
        setChapterNum(match[1]);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [chapterNum, chapterSegment]);

  // Obtener usuario autenticado (DEBE estar antes de usarlo en readers)
  const { user } = useAuth();

  // Lectores en tiempo real del capítulo actual (excluye al usuario actual)
  const { readers: allReaders } = useChapterReaders(slug, chapterNum, { enabled: !!user?.id });
  
  // Filtrar: mostrar solo otros usuarios (no al usuario actual)
  // Solo usuarios autenticados pueden ver this feature
  const readers = React.useMemo(() => {
    if (!Array.isArray(allReaders)) return [];
    
    // Si no hay usuario autenticado, no mostrar nada
    if (!user?.id) {
      return [];
    }
    
    // Filtrar lectores válidos - excluye al usuario actual
    const filtered = allReaders.filter(reader => {
      // Validar que el lector sea válido
      if (!reader || typeof reader !== 'object') {
        return false;
      }
      
      // Validar que tenga al menos ID o username
      if (!reader.userId && !reader.username) {
        return false;
      }
      
      // Comparar por ID (más confiable)
      if (reader.userId && user.id) {
        const isSameUser = Number(reader.userId) === Number(user.id);
        if (isSameUser) {
          return false;
        }
      }
      
      // Comparar por username como fallback
      if (reader.username && user.username && reader.username === user.username) {
        return false;
      }
      
      return true;
    });
    
    return filtered;
  }, [allReaders, user]);
  
  const readersCount = readers.length;

  // Navegación instantánea: solo cambia estado + URL, sin Next.js routing
  const navigateToChapter = useCallback((targetChapter) => {
    const newUrl = `${seriesBasePath}/${slug}/${chapterSegment}/${targetChapter}`;
    window.history.pushState(null, '', newUrl);
    setChapterNum(String(targetChapter));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [slug, seriesBasePath, chapterSegment]);

  // Usar initialPages como estado inicial → disponible en el primer render (SSR)
  const { pages: hookPages } = useChapterPages(slug, chapterNum);
  const { series: hookSeries } = useSeriesDetail(slug);

  // Combinar datos SSR con datos del hook (hook puede actualizar tras hidratación)
  const pages = hookPages.length > 0 ? hookPages : initialPages;
  const series = hookSeries || initialSeries;

  // Red adaptativa
  const networkInfo = useNetworkQuality();
  const networkConfig = useMemo(() => getQueueConfig(networkInfo), [networkInfo]);

  // Estado: capítulo actual completamente cargado
  const [isCurrentChapterLoaded, setIsCurrentChapterLoaded] = useState(false);

  // Reset al cambiar de capítulo
  useEffect(() => {
    setIsCurrentChapterLoaded(false);
  }, [slug, chapterNum]);

  const handleAllImagesLoaded = useCallback(() => {
    setIsCurrentChapterLoaded(true);
  }, []);

  // Hook de carga secuencial de imágenes (adaptativo)
  const { statuses: imageStatuses, markLoaded, markError, registerRef } = useImageQueue(pages, networkConfig, handleAllImagesLoaded);

  // Derivar capítulos anterior y siguiente desde la lista real de capítulos
  const { prevChapterNum, nextChapterNum, hasPrev, hasNext } = useMemo(() => {
    const currentNum = parseFloat(chapterNum);

    if (!series?.chapters?.length) {
      return {
        prevChapterNum: currentNum - 1,
        nextChapterNum: currentNum + 1,
        hasPrev: currentNum > 1,
        hasNext: true,
      };
    }

    const sorted = [...series.chapters].sort((a, b) => parseFloat(a.number) - parseFloat(b.number));
    const idx = sorted.findIndex(c => parseFloat(c.number) === currentNum);

    if (idx !== -1) {
      const prev = sorted[idx - 1];
      const next = sorted[idx + 1];
      return {
        prevChapterNum: prev?.number ?? currentNum - 1,
        nextChapterNum: next?.number ?? currentNum + 1,
        hasPrev: !!prev,
        hasNext: !!next,
      };
    }

    return {
      prevChapterNum: currentNum - 1,
      nextChapterNum: currentNum + 1,
      hasPrev: currentNum > 1,
      hasNext: true,
    };
  }, [chapterNum, series?.chapters]);

  // Prefetch del siguiente capítulo
  useNextChapterPrefetch({
    slug,
    nextChapterNum,
    networkConfig,
    enabled: isCurrentChapterLoaded,
  });

  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showHeader] = useState(true);
  // Modo de lectura: 'scroll' (por defecto para manhwa) o 'page'
  const [readingMode] = useState('scroll');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [chapterRequest, setChapterRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const containerRef = useRef(null);
  const hideControlsTimeout = useRef(null);

  // Hook de progreso de lectura persistente
  const {
    progress,
  } = useReadingProgress(slug, chapterNum, pages.length);

  const openLogin = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  // Obtener o crear el request para este capítulo
  useEffect(() => {
    let mounted = true;

    const fetchChapterRequest = async () => {
      if (!slug || !chapterNum) return;

      try {
        setLoadingRequest(true);
        const response = await getOrCreateChapterRequest({
          slug,
          chapterNum,
          seriesTitle: slug.replace(/-/g, ' ')
        });

        if (mounted && response?.data?.request) {
          setChapterRequest(response.data.request);
        }
      } catch {
        // Silently handle request errors
      } finally {
        if (mounted) {
          setLoadingRequest(false);
        }
      }
    };

    fetchChapterRequest();

    return () => {
      mounted = false;
    };
  }, [slug, chapterNum]);

  // Auto-hide controles
  useEffect(() => {
    if (showControls) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 1500);
    }
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [showControls]);

  // Mostrar controles al mover el ratón
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
  }, []);

  // Función para limpiar estado de fullscreen problemático
  const cleanupFullscreenState = useCallback(() => {
    try {
      // Forzar salida de fullscreen si está activo
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }

      // Resetear estilos del body que pueden quedar colgados
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';

      // Resetear estilos del html
      document.documentElement.style.overflow = '';
      document.documentElement.style.position = '';
      document.documentElement.style.width = '';
      document.documentElement.style.height = '';

      // Resetear estado interno
      setIsFullscreen(false);
    } catch {
      // Silently handle cleanup errors
    }
  }, []);

  const nextPage = useCallback(async () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else if (hasNext) {
      navigateToChapter(nextChapterNum);
    }
  }, [currentPage, pages.length, navigateToChapter, nextChapterNum, hasNext]);

  const prevPage = useCallback(async () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    } else if (hasPrev) {
      navigateToChapter(prevChapterNum);
    }
  }, [currentPage, navigateToChapter, prevChapterNum, hasPrev]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch {
      // En caso de error, resetear el estado
      setIsFullscreen(false);
    }
  }, []);

  // Navegación por teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (readingMode === 'page') {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          nextPage();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevPage();
        }
      }
      if (e.key === 'Escape') {
        if (isFullscreen) {
          cleanupFullscreenState();
        }
      }
      if (e.key === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingMode, isFullscreen, nextPage, prevPage, toggleFullscreen, cleanupFullscreenState]);

  // Detectar cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Limpiar estado de pantalla completa al montar/desmontar componente
  useEffect(() => {
    // Limpiar cualquier estado de pantalla completa residual al montar
    cleanupFullscreenState();

    return () => {
      // Limpiar al desmontar el componente
      cleanupFullscreenState();
    };
  }, [slug, chapterNum, cleanupFullscreenState]); // Ejecutar cuando cambie el capítulo

  return (
    <div
      ref={containerRef}
      data-reader-container
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--page-bg)', // Global theme variable
        color: 'var(--text-color)',        // Global theme variable
        position: 'relative',
        overflow: 'auto', // Asegurar que el scroll esté siempre disponible
        width: '100%'
      }}
      onMouseMove={handleMouseMove}
    >
      {/* Barra de Progreso de Lectura */}
      <ReadingProgressBar progress={progress} position="top" />

      {/* Notificación de lectura restaurada */}
      {/* <ReadingRestoredNotice show={hasRestoredPosition} progress={progress} /> */}

      {/* Header Flotante Personalizado */}
      {showHeader && (
        <ReaderHeader
          chapterNum={chapterNum}
          slug={slug}
          seriesBasePath={seriesBasePath}
          lang={lang}
        />
      )}

      {/* Contenido - Modo Scroll */}
      {readingMode === 'scroll' && (
        <div style={{
          paddingTop: '55px',
          // paddingBottom: '60px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          scrollBehavior: 'smooth',
          overflowX: 'hidden'
        }}>
          {/* Título y Capítulo */}
          <div style={{
            width: '100%',
            maxWidth: '800px',
            textAlign: 'center',
          }}>

            {/* Título del Manhwa - H1 Optimizado con Keyword Completa */}
            <h1 style={{
              fontSize: 'clamp(24px, 5vw, 36px)',
              fontWeight: '700',
              color: 'var(--text-color)',
              margin: '0',
              lineHeight: '1.2',
              fontFamily: 'var(--font-playfair, Georgia, serif)',
            }}>
              {series?.title || slug.replace(/-/g, ' ')}
              <span style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: '0' }}>
                {lang === 'en' ? 'Chapter' : 'Capítulo'} {chapterNum}
              </span>
            </h1>

            {/* Número de Capítulo con botones de navegación a los lados */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '5px',
            }}>
              {/* Botón Capítulo Anterior */}
              {hasPrev ? (
                <a
                  href={`${seriesBasePath}/${slug}/${chapterSegment}/${prevChapterNum}`}
                  title={`${lang === 'en' ? 'Chapter' : 'Capítulo'} ${prevChapterNum}`}
                  onClick={e => { e.preventDefault(); navigateToChapter(prevChapterNum); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, opacity 0.2s ease',
                    fontSize: '22px',
                    lineHeight: '1',
                    padding: '0',
                    opacity: 0.8,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.opacity = '0.8';
                  }}
                >
                  ‹
                </a>
              ) : (
                <div style={{ width: '28px' }} />
              )}

              {/* Texto "Capítulo N" */}
              <div style={{
                fontSize: '14px',
                fontWeight: '700',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                opacity: 0.95,
              }}>
                {lang === 'en' ? 'Chapter' : 'Capítulo'} {chapterNum}
              </div>

              {/* Botón Capítulo Siguiente */}
              {hasNext ? (
                <a
                  href={`${seriesBasePath}/${slug}/${chapterSegment}/${nextChapterNum}`}
                  title={`${lang === 'en' ? 'Chapter' : 'Capítulo'} ${nextChapterNum}`}
                  onClick={e => { e.preventDefault(); navigateToChapter(nextChapterNum); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#667eea',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, opacity 0.2s ease',
                    fontSize: '22px',
                    lineHeight: '1',
                    padding: '0',
                    opacity: 0.8,
                    textDecoration: 'none',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.2)';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.opacity = '0.8';
                  }}
                >
                  ›
                </a>
              ) : (
                <div style={{ width: '28px' }} />
              )}
            </div>

            {/* Línea decorativa */}
            <div style={{
              width: '60px',
              height: '3px',
              background: 'linear-gradient(90deg, transparent, #667eea, transparent)',
              margin: '10px auto 0',
              borderRadius: '2px',
              marginBottom: '20px',
            }} />
          </div>

          {/* Título de sección para SEO (Oculto visualmente) - Nivel H2 para contenido principal */}
          <h2 style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: '0' }}>
            {lang === 'en' ? 'Read' : 'Leer'} {series?.title || slug.replace(/-/g, ' ')} {lang === 'en' ? 'Chapter' : 'Capítulo'} {chapterNum} {lang === 'en' ? 'Online - Images' : 'Online - Imágenes'}
          </h2>

          {/* Imágenes del capítulo - carga secuencial */}
          {pages.map((page, index) => (
            <ChapterImage
              key={page.number || index}
              page={page}
              index={index}
              status={imageStatuses[index] || 'pending'}
              onLoad={markLoaded}
              onError={markError}
              registerRef={registerRef}
              totalPages={pages.length}
              alt={lang === 'en'
                ? `Page ${page.number || index + 1} of ${series?.title || slug.replace(/-/g, ' ')} Chapter ${chapterNum} - Korean webtoon image in English`
                : `Página ${page.number || index + 1} del manhwa ${series?.title || slug.replace(/-/g, ' ')} Capítulo ${chapterNum} - Imagen del webtoon coreano en español`}
            />
          ))}
        </div>
      )}

      {/* Contenido - Modo Página */}
      {readingMode === 'page' && pages.length > 0 && (
        <div style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          paddingTop: '70px',
          paddingBottom: '60px',
          overflowX: 'hidden'
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {pages[currentPage]?.url ? (
            <img
              src={pages[currentPage].url}
              alt={lang === 'en'
                ? `Page ${currentPage + 1} of ${series?.title || (typeof slug === 'string' ? slug.replace(/-/g, ' ') : '')} Chapter ${chapterNum} - Read manhwa in English on Manhwa Imperial`
                : `Página ${currentPage + 1} del manhwa ${series?.title || (typeof slug === 'string' ? slug.replace(/-/g, ' ') : '')} Capítulo ${chapterNum} - Leer manhwa en español en Manhwa Imperial`}
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: 'calc(100vh - 120px)',
                objectFit: 'contain'
              }}
              onError={(e) => { e.target.style.opacity = '0.3'; }}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--dimmed-text, #888)',
              fontSize: '14px',
            }}>
              <span style={{ fontSize: '32px', opacity: 0.5 }}>&#9888;</span>
              <span>{lang === 'en' ? 'Image not available' : 'Imagen no disponible'}</span>
            </div>
          )}
        </div>
      )}

      {/* Rating Section - Calificación PROPIA del capítulo (no de la serie) */}
      <div style={{
        maxWidth: '900px',
        margin: '1rem auto',
        padding: '0 1rem',
      }}>
        <ChapterRating
          slug={slug}
          chapterNum={chapterNum}
        />
      </div>

      {/* Chapter Navigation (New) */}
      <h2 style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: '0' }}>
        {lang === 'en' ? 'Chapter navigation for' : 'Navegación de Capítulos de'} {series?.title || slug.replace(/-/g, ' ')}
      </h2>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <ChapterNavigation
          currentChapter={chapterNum}
          slug={slug}
          chapters={series?.chapters}
          onNavigate={navigateToChapter}
          seriesBasePath={seriesBasePath}
          lang={lang}
          chapterSegment={chapterSegment}
        />
        {readersCount > 0 && (
          <Group justify="center" style={{ marginTop: '0.75rem' }}>
            <Avatar.Group spacing="sm">
              {readers.slice(0, 4).map((r, i) => {
                // Generar un key único más robusto
                const uniqueKey = r.userId || r.username || `reader-${i}`;
                const displayName = r.displayName || r.username || (lang === 'en' ? 'User' : 'Usuario');
                
                return (
                  <Tooltip
                    key={uniqueKey}
                    label={displayName}
                    withArrow
                    position="top"
                    styles={{
                      tooltip: {
                        background: 'rgba(15,23,42,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                        backdropFilter: 'blur(8px)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        padding: '4px 10px',
                      },
                      arrow: { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' },
                    }}
                  >
                    <Avatar
                      src={r.avatarUrl}
                      name={displayName}
                      size={48}
                      radius="xl"
                      color="initials"
                      allowedInitialsColors={['cyan', 'pink', 'violet', 'yellow', 'orange', 'teal']}
                      style={{ 
                        cursor: 'default',
                        border: '2px solid rgba(255,255,255,0.1)',
                        transition: 'transform 0.2s ease',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                      }}
                    />
                  </Tooltip>
                );
              })}
              {readersCount > 4 && (
                <Tooltip
                  label={lang === 'en' ? `+${readersCount - 4} more reading` : `+${readersCount - 4} más leyendo`}
                  withArrow
                  position="top"
                  styles={{
                    tooltip: {
                      background: 'rgba(15,23,42,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '4px 10px',
                    },
                    arrow: { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' },
                  }}
                >
                  <Avatar
                    size={48}
                    radius="xl"
                    style={{ 
                      background: 'rgba(99,102,241,0.2)', 
                      cursor: 'default',
                      border: '2px solid rgba(255,255,255,0.1)',
                      transition: 'transform 0.2s ease'
                    }}
                  >
                    <Text size="sm" fw={700} style={{ color: '#a5b4fc' }}>
                      +{readersCount - 4}
                    </Text>
                  </Avatar>
                </Tooltip>
              )}
            </Avatar.Group>
          </Group>
        )}
      </div>

      {/* Banner 1: justo debajo del navegador de capítulos */}
      <AdsterraBannerDisplay instanceId="chapter-top" />
      {/* Adsterra Popunder - solo en páginas de contenido */}
      <Script
        id="adsterra-popunder"
        strategy="lazyOnload"
        src="https://landslidegraphsystems.com/d4/8d/1b/d48d1bf823309efe8856634dc189f561.js"
      />

      {/* Comentarios Section - Nivel H2 para sección principal */}
      <div style={{
        maxWidth: '900px',
        margin: '2rem auto',
        padding: '0 1rem',
        paddingBottom: '100px'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 'bold',
          marginBottom: '1.5rem',
          color: 'var(--text-color)',
          borderLeft: '4px solid #667eea',
          paddingLeft: '1rem'
        }}>
          {lang === 'en' ? 'Chapter comments' : 'Comentarios del Capítulo'} {chapterNum}: {series?.title || slug}
        </h2>

        {loadingRequest ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--dimmed-text)' }}>{lang === 'en' ? 'Loading comments...' : 'Cargando comentarios...'}</p>
          </div>
        ) : chapterRequest ? (
          <ComentariosWrapper
            chapterRequest={chapterRequest}
            slug={slug}
            chapterNum={chapterNum}
            openLogin={openLogin}
            user={user}
            lang={lang}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--dimmed-text)' }}>{lang === 'en' ? 'Comments could not be loaded.' : 'No se pudieron cargar los comentarios.'}</p>
          </div>
        )}
      </div>

      {/* Banner 2: al final, debajo de comentarios */}
      <div style={{ maxWidth: '900px', margin: '0 auto 2rem', padding: '0 1rem' }}>
        <AdsterraBannerDisplay instanceId="chapter-bottom" loadDelayMs={1200} deferUntilVisible />
      </div>

      {/* Login Modal */}
      <LoginModal
        opened={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
