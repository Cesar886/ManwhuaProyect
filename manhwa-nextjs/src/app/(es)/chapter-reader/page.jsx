'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';

import { useChapterPages, useSeriesDetail } from '@/hooks/useSpaces';
import ChapterNavigation from '@/components/ChapterNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { getOrCreateChapterRequest } from '@/api/requests';
import Comentarios from '@/components/Comentarios';
import LoginModal from '@/components/LoginModal';
import ReaderHeader from '@/components/ReaderHeader';

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
  const router = useRouter();
  const slug = params.slug;
  const chapterNum = params.numero;
  
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
  const [chapterRequest, setChapterRequest] = useState(null);
  const [loadingRequest, setLoadingRequest] = useState(true);
  const containerRef = useRef(null);
  const hideControlsTimeout = useRef(null);

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
        console.error('Error obteniendo request del capítulo:', error);
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

  const nextPage = useCallback(() => {
    if (currentPage < pages.length - 1) {
      setCurrentPage(prev => prev + 1);
    } else {
      // Ir al siguiente capítulo
      router.push(`/manhwa/${slug}/capitulo/${parseInt(chapterNum) + 1}`);
    }
  }, [currentPage, pages.length, router, slug, chapterNum]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    } else if (parseInt(chapterNum) > 1) {
      router.push(`/manhwa/${slug}/capitulo/${parseInt(chapterNum) - 1}`);
    }
  }, [currentPage, chapterNum, router, slug]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
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
          document.exitFullscreen?.();
        }
      }
      if (e.key === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readingMode, isFullscreen, nextPage, prevPage, toggleFullscreen]);

  // Detectar cambios de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--page-bg)',
        color: 'var(--text-color)',
        position: 'relative'
      }}
      onMouseMove={handleMouseMove}
    >
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
          paddingTop: '70px',
          paddingBottom: '60px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          scrollBehavior: 'smooth',
          overflowX: 'hidden'
        }}>
          {pages.map((page, index) => (
            <div key={page.number || index} style={{ position: 'relative', width: '100%', minHeight: '100px' }}>
              <Image
                src={page.url}
                alt={`Página ${page.number || index + 1}`}
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
            alt={`Página ${currentPage + 1}`}
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

      {/* Chapter Navigation */}
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <ChapterNavigation
          currentChapter={chapterNum}
          slug={slug}
          chapters={series?.chapters}
        />
      </div>

      {/* Comentarios Section */}
      <div style={{
        maxWidth: '900px',
        margin: '2rem auto',
        padding: '0 1rem',
        paddingBottom: '100px'
      }}>
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