"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

import dynamic from 'next/dynamic';
import { useChapterPages, useSeriesDetail } from '../../../../../hooks/useSpaces';
import ChapterNavigation from '../../../../../components/ChapterNavigation';
import { useAuth } from '../../../../../contexts/AuthContext';
import { getOrCreateChapterRequest } from '../../../../../api/requests';
import ReaderHeader from '../../../../../components/ReaderHeader';
import { useReadingProgress } from '../../../../../hooks/useReadingProgress'; ``
import ReadingProgressBar from '../../../../../components/ReadingProgressBar';
import ChapterRating from '../../../../../components/ChapterRating';

// Carga dinámica para evitar que el CSS de Mantine sea preloaded innecesariamente
const Comentarios = dynamic(() => import('../../../../../components/Comentarios'), { ssr: false });
const LoginModal = dynamic(() => import('../../../../../components/LoginModal'), { ssr: false });
// import ReadingRestoredNotice from '../../../../../components/ReadingRestoredNotice';
// import chapterNavStyles from './ChapterReader.module.css'; 

// Wrapper para estabilizar el objeto detailRequest y evitar re-renders infinitos
function ComentariosWrapper({ chapterRequest, slug, chapterNum, openLogin, user }) {
  const detailRequest = useMemo(() => ({
    type: 'request',
    targetType: 'request',
    id: chapterRequest.id,
    targetId: chapterRequest.id,
    title: chapterRequest.title || `${slug.replace(/-/g, ' ')} - Capítulo ${chapterNum}`,
    slug: slug,
    chapterNum: chapterNum
  }), [chapterRequest.id, chapterRequest.title, slug, chapterNum]);


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
 */
export default function ChapterReader() {
  const params = useParams();
  const slug = params?.slug;
  const chapterNum = params?.numero;
  const router = useRouter();
  const { pages } = useChapterPages(slug, chapterNum);
  const { series } = useSeriesDetail(slug);
  const { user } = useAuth();

  const [currentPage, setCurrentPage] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showHeader] = useState(true);
  // Modo de lectura: 'scroll' (por defecto para manhwa) o 'page'
  const [readingMode] = useState('scroll');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showStylesPanel, setShowStylesPanel] = useState(false);
  const [chapterRequest, setChapterRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const containerRef = useRef(null);
  const hideControlsTimeout = useRef(null);

  // Hook de progreso de lectura persistente
  const {
    progress,
    hasRestoredPosition,
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
      } catch (error) {
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
    } catch (error) {
      // Silently handle cleanup errors
    }
  }, []);

  const nextPage = useCallback(async () => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      // Ir al siguiente capítulo (mantener pantalla completa si está activa)
      router.push(`/manhwa/${slug}/capitulo/${parseInt(chapterNum) + 1}`);
    }
  }, [currentPage, pages.length, router, slug, chapterNum]);

  const prevPage = useCallback(async () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    } else if (parseInt(chapterNum) > 1) {
      // Ir al capítulo anterior (mantener pantalla completa si está activa)
      router.push(`/manhwa/${slug}/capitulo/${parseInt(chapterNum) - 1}`);
    }
  }, [currentPage, chapterNum, router, slug]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await containerRef.current?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (error) {
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
                Capítulo {chapterNum}
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
              {parseInt(chapterNum) > 1 ? (
                <button
                  onClick={() => router.push(`/manhwa/${slug}/capitulo/${parseInt(chapterNum) - 1}`)}
                  title={`Capítulo ${parseInt(chapterNum) - 1}`}
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
                </button>
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
                Capítulo {chapterNum}
              </div>

              {/* Botón Capítulo Siguiente */}
              <button
                onClick={() => router.push(`/manhwa/${slug}/capitulo/${parseInt(chapterNum) + 1}`)}
                title={`Capítulo ${parseInt(chapterNum) + 1}`}
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
              </button>
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
            Leer {series?.title || slug.replace(/-/g, ' ')} Capítulo {chapterNum} Online - Imágenes
          </h2>

          {/* Imágenes del capítulo */}
          {pages.map((page, index) => (
            <div key={page.number || index} style={{ position: 'relative', width: '100%', minHeight: '100px' }}>
              <Image
                src={page.url}
                alt={`${series?.title || slug} - Capítulo ${chapterNum} - Página ${page.number || index + 1}`}
                width={0}
                height={0}
                sizes="100vw"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                }}
                priority={index < 2}
              />
            </div>
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
          <Image
            src={pages[currentPage]?.url}
            alt={`${series?.title || slug} - Capítulo ${chapterNum} - Página ${currentPage + 1}`}
            width={0}
            height={0}
            sizes="100vh"
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: 'calc(100vh - 120px)',
              objectFit: 'contain'
            }}
            priority={true}
          />
        </div>
      )}

      {/* Chapter Navigation (New) */}
      <h2 style={{ position: 'absolute', width: '1px', height: '1px', padding: '0', margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: '0' }}>
        Navegación de Capítulos de {series?.title || slug.replace(/-/g, ' ')}
      </h2>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <ChapterNavigation
          currentChapter={chapterNum}
          slug={slug}
          chapters={series?.chapters}
        />
      </div>

      {/* Rating Section - Calificación PROPIA del capítulo (no de la serie) */}
      <div style={{
        maxWidth: '900px',
        margin: '1rem auto',
        padding: '0 1rem',
        borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.1))',
      }}>
        <ChapterRating
          slug={slug}
          chapterNum={chapterNum}
        />
      </div>

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
          Comentarios del Capítulo {chapterNum}: {series?.title || slug}
        </h2>

        {loadingRequest ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--dimmed-text)' }}>Cargando comentarios...</p>
          </div>
        ) : chapterRequest ? (
          <ComentariosWrapper
            chapterRequest={chapterRequest}
            slug={slug}
            chapterNum={chapterNum}
            openLogin={openLogin}
            user={user}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--dimmed-text)' }}>No se pudieron cargar los comentarios.</p>
          </div>
        )}
      </div>

      {/* Login Modal */}
      <LoginModal
        opened={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />
    </div>
  );
}
