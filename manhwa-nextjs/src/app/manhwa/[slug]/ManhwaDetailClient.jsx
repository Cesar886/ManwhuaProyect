"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  IconArrowLeft, IconBook, IconClock, IconEye, IconChevronRight, IconChevronDown, IconChevronUp,
  IconCalendar, IconUser, IconTag, IconStar, IconTrendingUp, IconEdit, IconHeart, IconBookmark, IconBell,
  IconBellOff, IconShare, IconFlag, IconBrandTwitter, IconBrandFacebook, IconLink, IconQrcode,
  IconFilter, IconSearch, IconDownload, IconCheck, IconX, IconAlertTriangle, IconMessageCircle,
  IconChartBar, IconUsers, IconGlobe, IconTrash, IconEyeOff, IconSparkles, IconPlayerPlay, IconRefresh,
  IconThumbUp, IconThumbDown, IconChevronLeft, IconDots, IconPhoto, IconAward,
  IconFlame, IconBolt, IconAlertCircle, IconCopy, IconExternalLink, IconSettings, IconPlus, IconMinus,
  IconPhotoOff, IconQuestionMark
} from '@tabler/icons-react';
import { useSeriesDetail } from '../../../hooks/useSpaces';
import { useAuth } from '../../../contexts/AuthContext';
import {
  updateSeries, addBookmark, removeBookmark, updateBookmark,
  toggleBookmarkNotifications, trackShare
} from '../../../api/requests';
import { useSeriesProgress } from '../../../hooks/useSeriesProgress';
import styles from './ManhwaDetail.module.css';
import SeriesEditModalV2 from '../../../components/SeriesEditModalV2';
import Comentarios from '../../../components/Comentarios';
import { normalizeImageUrl } from '../../../utils/imageUtils';
import { Pill, Container, Skeleton, Group, Stack, Box } from '@mantine/core';
import ManhwaCover from '../../../components/ManhwaCover';
import Header from '@/components/Header';
import SimilarManhwas from '../../../components/SimilarManhwas';
import LinkedSynopsis from '../../../components/LinkedSynopsis';
import SeriesRating from '../../../components/SeriesRating';
// SEO: Constantes para contenido optimizado
import { SEO_CONTENT, getImageAlt, getAnchorText } from '@/lib/seo/constants';


// Componente de Placeholder de Portada mejorado
const CoverPlaceholder = ({ title, className }) => {
  // Generar color basado en el título
  const getColor = (str) => {
    let hash = 0;
    for (let i = 0; i < (str?.length || 0); i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`;
  };

  const bgColor = getColor(title);
  const initials = title?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

  return (
    <div className={`${styles.coverPlaceholder} ${className || ''}`} style={{ background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)` }}>
      <div className={styles.placeholderContent}>
        <IconPhotoOff size={48} strokeWidth={1.5} />
        <span className={styles.placeholderInitials}>{initials}</span>
      </div>
    </div>
  );
};

// Componente de Imagen de Portada con manejo de errores optimizado
const CoverImage = ({ src, alt, className, onLoad }) => {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = React.useRef(null);
  const timeoutRef = React.useRef(null);

  // Resetear estados cuando cambia src
  useEffect(() => {
    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // No actualizar estado aquí para evitar renders en cascada
    // Si no hay src, mostrar placeholder inmediatamente
    if (!src) {
      queueMicrotask(() => {
        setImageError(true);
        setIsLoading(false);
      });
      return;
    }
    // Validar URL básica
    const cleanSrc = src.trim();
    if (!cleanSrc || cleanSrc === 'undefined' || cleanSrc === 'null') {
      queueMicrotask(() => {
        setImageError(true);
        setIsLoading(false);
      });
      return;
    }
    // Resetear estados
    queueMicrotask(() => {
      setImageError(false);
      setIsLoading(true);
    });
    // Timeout de seguridad: 8 segundos para cargar la imagen
    timeoutRef.current = setTimeout(() => {
      // Intentar retry una vez
      if (retryCount < 1) {
        setRetryCount(prev => prev + 1);
      } else {
        setImageError(true);
        setIsLoading(false);
      }
    }, 8000);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [src, retryCount]);

  const handleError = useCallback((e) => {
    console.error('❌ Error cargando imagen:', src, e?.type);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Intentar retry una vez antes de mostrar placeholder
    if (retryCount < 1) {
      setRetryCount(prev => prev + 1);
    } else {
      setImageError(true);
      setIsLoading(false);
    }
  }, [src, retryCount]);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
    setImageError(false);
    setRetryCount(0);
    onLoad?.();
  }, [onLoad, src]);

  // Agregar cache-busting determinista para evitar Date.now en render
  const cacheBuster = useMemo(() => {
    if (!src) return '0';
    // Pequeña función hash determinista basada en la URL + retryCount
    let h = 0;
    const str = String(src) + '|' + retryCount;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return String(Math.abs(h));
  }, [src, retryCount]);

  const separator = src && src.includes('?') ? '&' : '?';
  const imageSrc = src ? `${src}${separator}t=${cacheBuster}${retryCount > 0 ? `&retry=${retryCount}` : ''}` : '';

  if (!src || imageError) {
    return <CoverPlaceholder title={alt} className={className} />;
  }

  return (
    <>
      {isLoading && (
        <div className={`${styles.coverLoading} ${className}`}>
          <div className={styles.coverLoadingSpinner} />
        </div>
      )}
      <img
        ref={imgRef}
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? styles.coverHidden : ''}`}
        onError={handleError}
        onLoad={handleLoad}
        loading="eager"
        decoding="async"
      />
    </>
  );
};

// Componente de Badge
const Badge = ({ type, children, icon: Icon }) => {
  const badgeStyles = {
    new: styles.badgeNew,
    updated: styles.badgeUpdated,
    popular: styles.badgePopular,
    completed: styles.badgeCompleted,
    ongoing: styles.badgeOngoing,
    paused: styles.badgePaused,
    cancelled: styles.badgeCancelled,
    adult: styles.badgeAdult,
    manhwa: styles.badgeManhwa,
    manhua: styles.badgeManhua,
    manga: styles.badgeManga,
  };

  return (
    <span className={`${styles.badge} ${badgeStyles[type] || ''}`}>
      {Icon && <Icon size={12} />}
      {children}
    </span>
  );
};

// Modal de Compartir
const ShareModal = ({ isOpen, onClose, series, slug }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/manhwa/${slug}` : `https://manhwaimperial.com/manhwa/${slug}`;

  const handleShare = async (platform) => {
    await trackShare(series.id, platform).catch(() => { });

    const text = `Lee "${series.title}" en Manhwa Imperial`;
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text} ${shareUrl}`)}`,
    };

    if (urls[platform]) {
      window.open(urls[platform], '_blank', 'width=600,height=400');
    }
    onClose();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.shareModal} onClick={e => e.stopPropagation()}>
        <h3>Compartir</h3>
        <div className={styles.shareButtons}>
          <button onClick={() => handleShare('twitter')} className={styles.shareTwitter}>
            <IconBrandTwitter size={20} /> Twitter
          </button>
          <button onClick={() => handleShare('facebook')} className={styles.shareFacebook}>
            <IconBrandFacebook size={20} /> Facebook
          </button>
          <button onClick={() => handleShare('whatsapp')} className={styles.shareWhatsapp}>
            <IconMessageCircle size={20} /> WhatsApp
          </button>
        </div>
        <div className={styles.copyLinkContainer}>
          <input type="text" value={shareUrl} readOnly className={styles.copyInput} />
          <button onClick={copyLink} className={styles.copyButton}>
            {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <button onClick={onClose} className={styles.closeShareModal}>
          <IconX size={20} />
        </button>
      </div>
    </div>
  );
};

// Modal de Agregar a Lista
const AddToListModal = ({ isOpen, onClose, currentStatus, onUpdateStatus }) => {
  const statuses = [
    { value: 'reading', label: 'Leyendo', icon: IconBook },
    { value: 'completed', label: 'Completado', icon: IconCheck },
    { value: 'plan_to_read', label: 'Pendiente', icon: IconClock },
    { value: 'dropped', label: 'Abandonado', icon: IconX },
    { value: 'rereading', label: 'Releyendo', icon: IconRefresh },
  ];

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.listModal} onClick={e => e.stopPropagation()}>
        <h3>Agregar a lista</h3>
        <div className={styles.listOptions}>
          {statuses.map((status) => {
            const IconComponent = status.icon;
            return (
              <button
                key={status.value}
                className={`${styles.listOption} ${currentStatus === status.value ? styles.listOptionActive : ''}`}
                onClick={() => { onUpdateStatus(status.value); onClose(); }}
              >
                <IconComponent size={18} />
                {status.label}
                {currentStatus === status.value && <IconCheck size={16} className={styles.checkIcon} />}
              </button>
            );
          })}
        </div>
        <button onClick={onClose} className={styles.closeListModal}>
          <IconX size={20} />
        </button>
      </div>
    </div>
  );
};

// Componente de distribución de votos
const RatingDistribution = ({ distribution = {} }) => {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;
  const ratings = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className={styles.ratingDistribution}>
      {ratings.map(rating => {
        const count = distribution[rating] || 0;
        const percentage = (count / total) * 100;
        return (
          <div key={rating} className={styles.ratingBar}>
            <span className={styles.ratingLabel}>{rating}★</span>
            <div className={styles.barContainer}>
              <div className={styles.barFill} style={{ width: `${percentage}%` }} />
            </div>
            <span className={styles.ratingCount}>{count}</span>
          </div>
        );
      })}
    </div>
  );
};

// Componente de Capítulo
const ChapterCard = ({ chapter, slug, isRead, isNew }) => {
  const progressPercent = chapter.progress ? Math.round((chapter.progress.page / chapter.pageCount) * 100) : 0;
  const pathname = usePathname();
  const isActive = typeof window !== 'undefined' && pathname?.includes(`/capitulo/${chapter.number}`);

  return (
    <Link
      href={`/manhwa/${slug}/capitulo/${chapter.number}`}
      className={`${styles.chapterCard} ${isRead ? styles.chapterRead : ''} ${isActive ? styles.chapterActive : ''}`}
    >
      {chapter.thumbnail && (
        <img src={chapter.thumbnail} alt="" className={styles.chapterThumbnail} loading="lazy" />
      )}
      <div className={styles.chapterLeft}>
        <span className={styles.chapterNumber}>{chapter.number}</span>
        <div className={styles.chapterInfo}>
          <h3>
            Capítulo {chapter.number}
            {isNew && <Badge type="new">NUEVO</Badge>}
            {isRead && <IconCheck size={14} className={styles.readCheck} />}
          </h3>
          {chapter.title && <p className={styles.chapterTitle}>{chapter.title}</p>}
          <div className={styles.chapterMeta}>
            <Pill color='blue'>Nuevo</Pill>
            {chapter.readTime && (
              <span className={styles.chapterMetaItem}>
                <IconClock size={12} />
                ~{chapter.readTime} min
              </span>
            )}
            {chapter.time && (
              <span className={styles.chapterMetaItem}>
                <IconCalendar size={12} />
                {chapter.time}
              </span>
            )}
            {chapter.commentCount > 0 && (
              <span className={styles.chapterMetaItem}>
                <IconMessageCircle size={12} />
                {chapter.commentCount}
              </span>
            )}
          </div>
          {progressPercent > 0 && progressPercent < 100 && (
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              <span className={styles.progressText}>{progressPercent}%</span>
            </div>
          )}
        </div>
      </div>
      <IconChevronRight size={20} className={styles.chapterArrow} />
    </Link>
  );
};

// Componente de Serie Relacionada
const RelatedSeriesCard = ({ series }) => (
  <Link href={`/manhwa/${series.slug}`} className={styles.relatedCard}>
    <img
      src={normalizeImageUrl(series.cover)}
      alt={series.title}
      className={styles.relatedCover}
      loading="lazy"
      crossOrigin="anonymous"
    />
    <div className={styles.relatedInfo}>
      <h4>{series.title}</h4>
      <div className={styles.relatedMeta}>
        <span><IconStar size={12} /> {series.rating || 'N/A'}</span>
        {series.genres?.slice(0, 2).map(g => (
          <span key={g} className={styles.relatedGenre}>{g}</span>
        ))}
      </div>
    </div>
  </Link>
);

/**
 * Página de detalle de un Manhwa desde DigitalOcean Spaces
 */
export default function ManhwaDetail({ initialSeries }) {
  const params = useParams();
  const slug = params?.slug;
  const { series: hookSeries, loading, error, refetch } = useSeriesDetail(slug, initialSeries);
  const { user, openLogin } = useAuth();

  // IMPORTANTE para SEO: Usar initialSeries como fallback si el hook no tiene datos
  // Esto evita Soft 404 en Google durante la hidratación
  const series = hookSeries || initialSeries;

  // Estados de UI
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [activeTab, setActiveTab] = useState('chapters'); // 'info' | 'chapters' | 'comments'

  // Hook optimizado para progreso de lectura
  const {
    bookmarkData,
    readingProgress,
    isInLibrary: isInLibraryFromHook,
    isFavorite: isFavoriteFromHook,
    readingStatus: readingStatusFromHook,
    hasProgress,
    lastReadChapter,
    progressPercent,
    refresh: refreshProgress,
  } = useSeriesProgress(series?.id, slug, user);

  // Estados locales para UI interactiva
  const [isInLibrary, setIsInLibrary] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [readingStatus, setReadingStatus] = useState(null);

  // Estados de Rating

  // Estados de Capítulos
  const [chapterFilter, setChapterFilter] = useState('all'); // 'all' | 'read' | 'unread'
  const [chapterSort, setChapterSort] = useState('oldest'); // 'newest' | 'oldest'
  const [chapterSearch, setChapterSearch] = useState('');
  const [showChapterFilters, setShowChapterFilters] = useState(false);

  // Ref para la sección de pestañas
  const tabsRef = React.useRef(null);

  // Verificar si el usuario es admin o superadmin
  const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

  // Sincronizar estados del hook con estados locales
  useEffect(() => {
    setIsInLibrary(isInLibraryFromHook);
    setIsFavorite(isFavoriteFromHook);
    setReadingStatus(readingStatusFromHook);
    setNotificationsEnabled(bookmarkData?.notifyNewChapter || false);
  }, [isInLibraryFromHook, isFavoriteFromHook, readingStatusFromHook, bookmarkData]);

  // Estado local para manejar actualizaciones de portada en tiempo real
  const [localCoverUrl, setLocalCoverUrl] = useState(null);
  // Estado para datos actualizados localmente mientras se recarga
  const [localUpdates, setLocalUpdates] = useState({});
  // Ref para evitar refetch duplicados
  const isRefetching = React.useRef(false);

  // Estado para la expansión de la sinopsis
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);

  // Resetear estados locales cuando cambia la serie
  useEffect(() => {
    setLocalCoverUrl(null);
    setLocalUpdates({});
    setIsSynopsisExpanded(false);
  }, [series?.slug]);

  // Escuchar evento de actualización de serie (desde modal de edición)
  useEffect(() => {
    const handleSeriesUpdate = (event) => {
      const {
        slug: updatedSlug,
        updateType,
        coverUrl: newCoverUrl,
        updatedFields,
        serverData
      } = event.detail || {};

      // Si es esta serie la que se actualizó
      if (updatedSlug === slug) {
        console.log('🔄 Serie actualizada:', { updateType, newCoverUrl, updatedFields, serverData });

        // Actualizar portada inmediatamente si viene en el evento
        if (newCoverUrl && (updateType === 'cover' || updateType === 'all')) {
          console.log('📸 Actualizando portada local:', newCoverUrl);
          // Agregar timestamp solo si es necesario forzar recarga
          const cleanUrl = newCoverUrl.split('?')[0];
          setLocalCoverUrl(`${cleanUrl}?t=${Date.now()}`);
        }

        // Si el servidor devolvió datos, usarlos para actualización inmediata
        if (serverData) {
          console.log('📦 Datos del servidor recibidos:', serverData);

          // Actualizar la portada si viene del servidor
          if (serverData.coverUrl) {
            const cleanUrl = serverData.coverUrl.split('?')[0];
            setLocalCoverUrl(`${cleanUrl}?t=${Date.now()}`);
          }

          // Mapear campos del servidor a localUpdates para actualización inmediata
          const serverUpdates = {};
          if (serverData.title) serverUpdates.title = serverData.title;
          if (serverData.originalTitle) serverUpdates.originalTitle = serverData.originalTitle;
          if (serverData.synopsis) serverUpdates.synopsis = serverData.synopsis;
          if (serverData.status) serverUpdates.status = serverData.status;
          if (serverData.author) serverUpdates.author = serverData.author;
          if (serverData.contentType) serverUpdates.contentType = serverData.contentType;
          if (serverData.releaseYear) serverUpdates.releaseYear = serverData.releaseYear;
          if (serverData.isAdult !== undefined) serverUpdates.isAdult = serverData.isAdult;
          if (serverData.isHot !== undefined) serverUpdates.isHot = serverData.isHot;
          if (serverData.isFeatured !== undefined) serverUpdates.isFeatured = serverData.isFeatured;
          // Géneros - convertir de objetos a array de nombres si es necesario
          if (serverData.genres && Array.isArray(serverData.genres)) {
            serverUpdates.genres = serverData.genres.map(g => typeof g === 'string' ? g : g.name);
          }

          if (Object.keys(serverUpdates).length > 0) {
            console.log('📝 Aplicando datos del servidor:', serverUpdates);
            setLocalUpdates(prev => ({ ...prev, ...serverUpdates }));
          }
        }
        // Si no hay serverData, usar los campos enviados (para retrocompatibilidad)
        else if (updatedFields && Object.keys(updatedFields).length > 0) {
          console.log('📝 Aplicando cambios locales:', updatedFields);
          setLocalUpdates(prev => ({ ...prev, ...updatedFields }));
        }

        // Refrescar datos del servidor (evitar duplicados)
        if (refetch && !isRefetching.current) {
          isRefetching.current = true;
          setTimeout(() => {
            refetch();
            // Reset después de un tiempo para permitir futuros refetch
            setTimeout(() => {
              isRefetching.current = false;
              // Limpiar actualizaciones locales una vez que el refetch completó
              setLocalUpdates({});
            }, 2000);
          }, 300);
        }
      }
    };

    window.addEventListener('seriesUpdated', handleSeriesUpdate);
    return () => window.removeEventListener('seriesUpdated', handleSeriesUpdate);
  }, [slug, refetch]);

  // Calcular la URL de la portada a usar (priorizar actualización local)
  const effectiveCoverUrl = useMemo(() => {
    // Si hay una URL local (recién actualizada), usarla
    if (localCoverUrl) {
      console.log('🎨 Usando portada local:', localCoverUrl);
      return localCoverUrl;
    }

    // Sino, usar la de la serie (puede venir como cover o coverUrl)
    let url = series?.cover || series?.coverUrl || series?.cover_url;

    // Validar y limpiar la URL
    if (url) {
      // Limpiar espacios y caracteres raros
      url = String(url).trim();

      // Rechazar valores inválidos
      if (!url || url === 'undefined' || url === 'null' || url === 'false') {
        console.warn('⚠️ URL de portada inválida:', url);
        return null;
      }

      // Asegurar que la URL es válida
      try {
        // Si es una URL relativa, convertirla a absoluta
        if (url.startsWith('/')) {
          url = window.location.origin + url;
        }

        // Si no tiene protocolo, agregar https
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          console.warn('⚠️ URL sin protocolo, agregando https://', url);
          url = 'https://' + url;
        }

        // Verificar que sea una URL válida
        const urlObj = new URL(url);
        return urlObj.href;
      } catch (e) {
        console.error('❌ Error validando URL de portada:', url, e.message);
        return null;
      }
    }

    return null;
  }, [localCoverUrl, series?.cover, series?.coverUrl, series?.cover_url]);

  // Crear objeto de serie efectivo que combina datos del servidor con actualizaciones locales
  const effectiveSeries = useMemo(() => {
    if (!series) return null;

    // Combinar datos originales con actualizaciones locales
    const merged = { ...series };

    // Aplicar actualizaciones locales
    if (Object.keys(localUpdates).length > 0) {
      // Mapear campos del formulario a propiedades de la serie
      if (localUpdates.title) merged.title = localUpdates.title;
      if (localUpdates.originalTitle) merged.alternativeTitle = localUpdates.originalTitle;
      if (localUpdates.synopsis) merged.synopsis = localUpdates.synopsis;
      if (localUpdates.author) merged.author = localUpdates.author;
      if (localUpdates.status) merged.status = localUpdates.status;
      if (localUpdates.contentType) merged.type = localUpdates.contentType;
      if (localUpdates.releaseYear) merged.releaseYear = localUpdates.releaseYear;
      if (localUpdates.isAdult !== undefined) merged.isAdult = localUpdates.isAdult;
      if (localUpdates.isHot !== undefined) merged.isHot = localUpdates.isHot;
      if (localUpdates.isFeatured !== undefined) merged.isFeatured = localUpdates.isFeatured;
      // Géneros - si vienen como array de nombres, convertir a formato esperado
      if (localUpdates.genres) {
        merged.genres = localUpdates.genres.map((name, idx) => ({
          id: `local-${idx}`,
          name: name,
          slug: name.toLowerCase().replace(/\s+/g, '-')
        }));
      }
    }

    // Normalizar géneros independientemente de su formato original
    if (merged.genres && Array.isArray(merged.genres)) {
      merged.genres = merged.genres.map((genre, index) => {
        if (typeof genre === 'string') return genre;
        if (genre && typeof genre === 'object') return genre.name || genre.label || `Género ${index + 1}`;
        return `Género ${index + 1}`;
      }).filter(Boolean); // Filtrar valores vacíos
    }

    return merged;
  }, [series, localUpdates]);

  // Handlers
  const handleToggleLibrary = async () => {
    if (!user) { openLogin(); return; }
    try {
      if (isInLibrary) {
        await removeBookmark(effectiveSeries?.id || series?.id);
        setIsInLibrary(false);
        setIsFavorite(false);
        setNotificationsEnabled(false);
        setReadingStatus(null);
      } else {
        await addBookmark(effectiveSeries?.id || series?.id, { status: 'reading' });
        setIsInLibrary(true);
        setReadingStatus('reading');
      }
      // Refrescar progreso después de actualizar
      await refreshProgress();
    } catch (err) {
      console.error('Error toggling library:', err);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) { openLogin(); return; }
    try {
      if (!isInLibrary) {
        await addBookmark(series.id, { isFavorite: true, status: 'reading' });
        setIsInLibrary(true);
        setIsFavorite(true);
        setReadingStatus('reading');
      } else {
        await updateBookmark(series.id, { isFavorite: !isFavorite });
        setIsFavorite(!isFavorite);
      }
      await refreshProgress();
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleToggleNotifications = async () => {
    if (!user) { openLogin(); return; }
    if (!isInLibrary) return;
    try {
      await toggleBookmarkNotifications(series.id, { enabled: !notificationsEnabled });
      setNotificationsEnabled(!notificationsEnabled);
      await refreshProgress();
    } catch (err) {
      console.error('Error toggling notifications:', err);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!user) { openLogin(); return; }
    try {
      if (!isInLibrary) {
        await addBookmark(series.id, { status });
        setIsInLibrary(true);
      } else {
        await updateBookmark(series.id, { status });
      }
      setReadingStatus(status);
      await refreshProgress();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleSaveChanges = async (changedFields) => {
    try {
      setUpdateError('');
      const result = await updateSeries(slug, changedFields);
      // No hacer refetch aquí, el evento seriesUpdated lo maneja
      return result; // Retornar resultado para el modal
    } catch (err) {
      console.error('Error al actualizar serie:', err);
      setUpdateError(err.message || 'Error al actualizar la serie');
      throw err;
    }
  };

  // Calcular capítulos filtrados
  const filteredChapters = useMemo(() => {
    if (!series?.chapters) return [];

    let chapters = [...series.chapters];

    // Filtrar por estado
    if (chapterFilter === 'read') {
      chapters = chapters.filter(c => c.isRead);
    } else if (chapterFilter === 'unread') {
      chapters = chapters.filter(c => !c.isRead);
    }

    // Filtrar por búsqueda
    if (chapterSearch) {
      const search = chapterSearch.toLowerCase();
      chapters = chapters.filter(c =>
        String(c.number).includes(search) ||
        (c.title && c.title.toLowerCase().includes(search))
      );
    }

    // Ordenar
    if (chapterSort === 'oldest') {
      chapters.sort((a, b) => a.number - b.number);
    } else {
      chapters.sort((a, b) => b.number - a.number);
    }

    return chapters;
  }, [series?.chapters, chapterFilter, chapterSort, chapterSearch]);

  // Determinar capítulo para continuar leyendo (primer capítulo por número)
  const continueReadingChapter = useMemo(() => {
    if (!series?.chapters?.length) return null;
    // Encontrar el capítulo con el número más bajo (soporta 0 y decimales)
    return series.chapters.reduce((min, ch) => {
      const a = parseFloat(ch.number);
      const b = parseFloat(min.number);
      const na = Number.isFinite(a) ? a : Infinity;
      const nb = Number.isFinite(b) ? b : Infinity;
      return na < nb ? ch : min;
    }, series.chapters[0]);
  }, [series?.chapters]);

  // Calcular badges
  const badges = useMemo(() => {
    if (!series) return [];
    const result = [];

    // // Tiempo desde última actualización
    // if (series.lastUpdated) {
    //   const daysSinceUpdate = Math.floor((Date.now() - new D
    // ate(series.lastUpdated)) / (1000 * 60 * 60 * 24));
    //   if (daysSinceUpdate <= 3) result.push({ type: 'updated', label: 'ACTUALIZADO' });
    // }

    // Tiempo desde creación
    if (series.createdAt) {
      const daysSinceCreation = Math.floor((Date.now() - new Date(series.createdAt)) / (1000 * 60 * 60 * 24));
      if (daysSinceCreation <= 7) result.push({ type: 'new', label: 'NUEVO' });
    }

    // Popular/Trending
    if (series.isHot || series.views > 10000) result.push({ type: 'popular', label: 'POPULAR' });

    // Estado
    if (series.status === 'completed') result.push({ type: 'completed', label: 'COMPLETO' });

    // Tipo de contenido
    if (series.type) result.push({ type: series.type.toLowerCase(), label: series.type.toUpperCase() });

    // Adulto
    if (series.isAdult) result.push({ type: 'adult', label: '+18' });

    return result;
  }, [series]);

  // Estados de carga y error
  // IMPORTANTE para SEO: No mostrar loading si hay datos SSR disponibles
  // Esto evita que Google vea skeletons en lugar del contenido real
  // Los skeletons solo se muestran en navegación cliente-side cuando no hay initialSeries
  if (loading && !series && !initialSeries) {
    return (
      <div className={styles.pageWrapper}>
        <Header />
        <Container size="lg" py="xl">
          {/* Hero Section Skeleton */}
          <div className={styles.heroSection}>
            <Group align="flex-start" gap="xl" wrap="nowrap">
              {/* Cover Skeleton */}
              <Box className={styles.coverContainer}>
                <Skeleton height={320} width={220} radius="md" />
              </Box>

              {/* Info Skeleton */}
              <Stack gap="md" style={{ flex: 1 }}>
                {/* Title */}
                <Skeleton height={40} width="70%" radius="md" />

                {/* Metadata */}
                <Group gap="xs">
                  <Skeleton height={24} width={80} radius="sm" />
                  <Skeleton height={24} width={60} radius="sm" />
                  <Skeleton height={24} width={70} radius="sm" />
                </Group>

                {/* Synopsis */}
                <Stack gap="xs">
                  <Skeleton height={16} width="100%" radius="sm" />
                  <Skeleton height={16} width="95%" radius="sm" />
                  <Skeleton height={16} width="90%" radius="sm" />
                  <Skeleton height={16} width="85%" radius="sm" />
                </Stack>

                {/* Genres */}
                <Group gap="xs">
                  <Skeleton height={28} width={70} radius="md" />
                  <Skeleton height={28} width={80} radius="md" />
                  <Skeleton height={28} width={65} radius="md" />
                  <Skeleton height={28} width={75} radius="md" />
                </Group>

                {/* Action Buttons */}
                <Group gap="md" mt="md">
                  <Skeleton height={42} width={140} radius="md" />
                  <Skeleton height={42} width={140} radius="md" />
                </Group>
              </Stack>
            </Group>
          </div>

          {/* Chapters Section Skeleton */}
          <Box mt="xl">
            <Skeleton height={32} width={200} radius="md" mb="md" />
            <Stack gap="xs">
              {Array.from({ length: 6 }).map((_, i) => (
                <Box key={i} p="md" style={{ background: 'var(--card-bg)', borderRadius: 'var(--mantine-radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <Group justify="space-between" align="center" wrap="nowrap">
                    <Group gap="md" style={{ flex: 1 }}>
                      <Skeleton height={50} width={50} radius="sm" />
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Skeleton height={16} width="60%" radius="sm" />
                        <Skeleton height={14} width="40%" radius="sm" />
                      </Stack>
                    </Group>
                    <Skeleton height={32} width={80} radius="md" />
                  </Group>
                </Box>
              ))}
            </Stack>
          </Box>
        </Container>
      </div>
    );
  }

  // IMPORTANTE para SEO: Solo mostrar error si NO hay datos SSR iniciales
  // Si hay initialSeries, siempre mostramos contenido para evitar Soft 404 en Google
  if (!series && !initialSeries) {
    return (
      <div className={`${styles.pageWrapper} ${styles.error}`}>
        <div className={styles.errorContent}>
          <IconAlertCircle size={48} className={styles.errorIcon} />
          <h2>Oops! Algo salió mal</h2>
          <p>{error || 'Manhwa no encontrado'}</p>
          <div className={styles.errorActions}>
            <button onClick={() => refetch?.()} className={styles.retryButton}>
              <IconRefresh size={18} /> Reintentar
            </button>
            <Link href="/home" className={styles.homeButton}>
              <IconArrowLeft size={18} /> Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.pageWrapper}>
      <Header />
      {/* Hero Section */}
      <div className={styles.heroSection}>
        <div
          className={styles.heroBackground}
          style={{
            backgroundImage: effectiveCoverUrl ? `url(${effectiveCoverUrl})` : 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)'
          }}
        />
        <div className={styles.heroOverlay} />

        {/* Hero Content: Cover + Title + CTA */}
        <div className={styles.heroContent}>
          <div className={styles.coverContainer}>
            <ManhwaCover
              src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
              alt={getImageAlt.cover(series.title)}
              className={styles.coverImage}
            />
            {(effectiveSeries?.isHot || series?.isHot) && (
              <div className={styles.hotBadge}>
                <IconFlame size={14} /> HOT
              </div>
            )}
          </div>

          <div className={styles.heroInfo}>
            {/* SEO: H1 es el título del manhwa */}
            <h1 className={styles.title}>
              {effectiveSeries?.title || series?.title}
              {/* Texto accesible para SEO */}
              <span className={styles.srOnly}> - Leer Manhwa en Español</span>
            </h1>

            {(effectiveSeries?.author || series?.author) && (
              <div className={styles.heroAuthor}>
                <IconUser size={14} />
                <Link href={`/autor/${effectiveSeries?.author || series?.author}`} className={styles.heroAuthorLink}>
                  {effectiveSeries?.author || series?.author}
                </Link>
              </div>
            )}

            {/* SEO: H2 para Sinopsis del Manhwa */}
            {(effectiveSeries?.synopsis || series?.synopsis) && (
              <>
                <h2 className={styles.srOnly}>
                  {SEO_CONTENT.manhwaDetail.getSynopsisTitle(effectiveSeries?.title || series?.title)}
                </h2>
                <LinkedSynopsis
                  text={effectiveSeries?.synopsis || series?.synopsis}
                  className={styles.heroSynopsis}
                />
              </>
            )}

            {/* CTA + Action buttons */}
            <div className={styles.heroActions}>
              {series.chapters && series.chapters.length > 0 && (
                <div style={{ width: '100%' }}>
                  <Link
                    href={`/manhwa/${slug}/capitulo/${
                      // Prioridad: último capítulo leído (si existe) > primer capítulo
                      lastReadChapter ||
                      continueReadingChapter?.number ||
                      series.chapters[0]?.number ||
                      1
                      }`}
                    className={styles.heroReadButton}
                  >
                    <IconPlayerPlay size={18} fill="currentColor" />
                    <span>
                      {/*
                        Lógica del texto:
                        - Si está logueado Y tiene progreso: "Continuar Leyendo"
                        - Si NO está logueado O NO tiene progreso: "Empezar a Leer"
                      */}
                      {user && hasProgress && lastReadChapter
                        ? 'Continuar Leyendo'
                        : 'Empezar a Leer'}
                    </span>
                  </Link>

                  {/* Mostrar progreso visual SOLO si está logueado Y tiene progreso */}
                  {user && hasProgress && lastReadChapter && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px 16px',
                      background: 'rgba(102, 126, 234, 0.1)',
                      borderRadius: '12px',
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <IconBookmark size={16} style={{ color: '#667eea' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '13px',
                          color: 'rgba(255, 255, 255, 0.9)',
                          marginBottom: '6px',
                          fontWeight: '500'
                        }}>
                          Capítulo {lastReadChapter}
                        </div>
                        <div style={{
                          width: '100%',
                          height: '4px',
                          background: 'rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            width: `${progressPercent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #667eea, #764ba2)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginTop: '4px'
                        }}>
                          {Math.round(progressPercent)}% completado
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.secondaryActions}>
                <button
                  onClick={handleToggleFavorite}
                  className={`${styles.heroActionBtn} ${isFavorite ? styles.heroActionActive : ''} ${isFavorite ? styles.heroActionFav : ''}`}
                  title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                >
                  <IconHeart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={handleToggleLibrary}
                  className={`${styles.heroActionBtn} ${isInLibrary ? styles.heroActionActive : ''}`}
                  title={isInLibrary ? 'En biblioteca' : 'Agregar a biblioteca'}
                >
                  <IconBookmark size={18} fill={isInLibrary ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => setIsShareModalOpen(true)}
                  className={styles.heroActionBtn}
                  title="Compartir"
                >
                  <IconShare size={18} />
                </button>
                {isInLibrary && (
                  <button
                    onClick={handleToggleNotifications}
                    className={`${styles.heroActionBtn} ${notificationsEnabled ? styles.heroActionActive : ''}`}
                    title={notificationsEnabled ? 'Desactivar notificaciones' : 'Activar notificaciones'}
                  >
                    {notificationsEnabled ? <IconBell size={18} /> : <IconBellOff size={18} />}
                  </button>
                )}
              </div>

              {/* Calificación de la serie - Visible debajo de los botones de acción */}
              <SeriesRating
                slug={slug}
                initialRating={series?.userInteraction?.userRating || 0}
                averageRating={parseFloat(series?.rating || series?.stats?.rating || 0)}
                totalRatings={parseInt(series?.ratingCount || series?.stats?.ratingCount || 0, 10)}
                onRate={() => refetch?.()}
                compact
              />
            </div>
          </div>
        </div>
      </div>

      {/* Info Section - Below hero, on page background */}
      {/* SEO H2: Información del Manhwa */}
      <h2 className={styles.srOnly}>
        {SEO_CONTENT.manhwaDetail.getInfoSection(effectiveSeries?.title || series?.title)}
      </h2>
      <div className={styles.infoSection}>
        {/* Generos - badges rectangulares con enlaces SEO */}
        {(effectiveSeries?.genres || series?.genres)?.length > 0 && (
          <div className={styles.infoCard}>
            <h3 className={styles.infoCardTitle}>Géneros del Manhwa</h3>
            <div className={styles.genresRow}>
              {(effectiveSeries?.genres || series?.genres)?.map((genre, index) => {
                const genreName = typeof genre === 'string'
                  ? genre
                  : genre?.name || genre?.label || `Género ${index + 1}`;
                const genreKey = genre?.id || genreName || index;
                const genreSlug = genreName.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return (
                  <Link
                    key={genreKey}
                    href={`/genero/${genreSlug}`}
                    className={styles.genreTag}
                    title={getAnchorText.genre(genreName)}
                  >
                    {genreName}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Detalles / Metadata */}
        <div className={styles.metaRow}>
          <div className={styles.metaItem}>
            <IconBook size={16} />
            <span>{series.chapters?.length || 0} capítulos</span>
          </div>
          <div className={styles.metaDivider} />
          <div className={styles.metaItem}>
            <span className={`${styles.statusDot} ${series.status === 'completed' ? styles.statusCompleted : series.status === 'paused' ? styles.statusPaused : styles.statusOngoing}`} />
            <span>
              {series.status === 'completed' ? 'Completado' :
                series.status === 'paused' ? 'Pausado' : 'En emisión'}
            </span>
          </div>
          {series.views > 0 && (
            <>
              <div className={styles.metaDivider} />
              <div className={styles.metaItem}>
                <IconEye size={16} />
                <span>{series.views > 1000 ? `${(series.views / 1000).toFixed(0)}K` : series.views}</span>
              </div>
            </>
          )}
          {series.rating > 0 && series.ratingCount > 0 && (
            <>
              <div className={styles.metaDivider} />
              <div className={styles.metaItem}>
                <IconStar size={16} className={styles.starIcon} />
                <span>{(parseFloat(series.rating) / 2).toFixed(1)} de 5</span>
                <span className={styles.ratingCountMeta}>({series.ratingCount} {series.ratingCount === 1 ? 'voto' : 'votos'})</span>
              </div>
            </>
          )}
          {badges.length > 0 && (
            <>
              <div className={styles.metaDivider} />
              {badges.map((badge, i) => (
                <Badge key={i} type={badge.type}>{badge.label}</Badge>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Tabs de navegación */}
      <div className={styles.tabsContainer} ref={tabsRef}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'chapters' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('chapters')}
          >
            <IconBook size={18} /> Capítulos
            {series.chapters?.length > 0 && (
              <span className={styles.tabBadge}>{series.chapters.length}</span>
            )}
          </button>
          {/* <button
            className={`${styles.tab} ${activeTab === 'comments' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            <IconMessageCircle size={18} /> Comentarios
            {series.commentCount > 0 && (
              <span className={styles.tabBadge}>{series.commentCount}</span>
            )}
          </button> */}
        </div>
      </div>

      {/* Sección de Contenido */}
      <div className={styles.contentSection}>

        {/* Tab: Capítulos */}
        {activeTab === 'chapters' && (
          <div className={styles.chaptersTab}>
            {/* SEO: Párrafo introductorio antes de la lista de capítulos */}
            <p className={styles.seoChapterIntro}>
              {SEO_CONTENT.manhwaDetail.getIntroText(
                effectiveSeries?.title || series?.title,
                (effectiveSeries?.genres || series?.genres || []).map(g => typeof g === 'string' ? g : g?.name).filter(Boolean),
                series.chapters?.length || 0
              )}
            </p>

            {/* Filtros de capítulos */}
            <div className={styles.chaptersHeader}>
              <h2 className={styles.sectionTitle}>
                {SEO_CONTENT.manhwaDetail.getChaptersTitle(effectiveSeries?.title || series?.title)}
                <span className={styles.chapterCount}>({filteredChapters.length})</span>
              </h2>

              <div className={styles.chapterControls}>
                <div className={styles.searchBox}>
                  <IconSearch size={16} />
                  <input
                    type="text"
                    placeholder="Buscar capítulo..."
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <div className={styles.filterContainer}>
                  <button
                    className={`${styles.filterButton} ${showChapterFilters ? styles.filterButtonActive : ''}`}
                    onClick={() => setShowChapterFilters(!showChapterFilters)}
                    title="Filtrar capítulos"
                  >
                    <IconFilter size={18} />
                    <span className={styles.filterLabel}>Filtros</span>
                    {chapterFilter !== 'all' && <div className={styles.filterBadge} />}
                  </button>

                  {/* Dropdown de Filtros */}
                  {showChapterFilters && (
                    <div className={styles.filterDropdown}>
                      <div className={styles.filterSection}>
                        <h4>Ordenar por</h4>
                        <div className={styles.filterOptions}>
                          <button
                            className={`${styles.filterOption} ${chapterSort === 'newest' ? styles.optionActive : ''}`}
                            onClick={() => setChapterSort('newest')}
                          >
                            <span>Más recientes</span>
                            {chapterSort === 'newest' && <IconCheck size={14} />}
                          </button>
                          <button
                            className={`${styles.filterOption} ${chapterSort === 'oldest' ? styles.optionActive : ''}`}
                            onClick={() => setChapterSort('oldest')}
                          >
                            <span>Más antiguos</span>
                            {chapterSort === 'oldest' && <IconCheck size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className={styles.filterDivider} />

                      <div className={styles.filterSection}>
                        <h4>Estado</h4>
                        <div className={styles.filterOptions}>
                          <button
                            className={`${styles.filterOption} ${chapterFilter === 'all' ? styles.optionActive : ''}`}
                            onClick={() => setChapterFilter('all')}
                          >
                            <span>Todos</span>
                            {chapterFilter === 'all' && <IconCheck size={14} />}
                          </button>
                          <button
                            className={`${styles.filterOption} ${chapterFilter === 'read' ? styles.optionActive : ''}`}
                            onClick={() => setChapterFilter('read')}
                          >
                            <span>Leídos</span>
                            {chapterFilter === 'read' && <IconCheck size={14} />}
                          </button>
                          <button
                            className={`${styles.filterOption} ${chapterFilter === 'unread' ? styles.optionActive : ''}`}
                            onClick={() => setChapterFilter('unread')}
                          >
                            <span>No leídos</span>
                            {chapterFilter === 'unread' && <IconCheck size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Lista de capítulos */}
            <div className={styles.chaptersList}>
              {filteredChapters.map((chapter) => {
                const daysSincePublish = chapter.publishedAt
                  ? Math.floor((Date.now() - new Date(chapter.publishedAt)) / (1000 * 60 * 60 * 24))
                  : 999;

                return (
                  <ChapterCard
                    key={chapter.number}
                    chapter={chapter}
                    slug={slug}
                    isRead={chapter.isRead}
                    isNew={daysSincePublish <= 3}
                  />
                );
              })}
            </div>

            {filteredChapters.length === 0 && (
              <div className={styles.emptyState}>
                <IconBook size={48} className={styles.emptyIcon} />
                <p>
                  {chapterSearch
                    ? 'No se encontraron capítulos con esa búsqueda.'
                    : 'No hay capítulos disponibles aún.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Tab: Comentarios */}
        {activeTab === 'comments' && (
          <div className={styles.commentsTab}>
            <Comentarios
              detailRequest={series}
              openLogin={openLogin}
              user={user}
            />
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* SEO: MANHWAS SIMILARES - Enlazado interno entre obras */}
      {/* ================================================================== */}
      <SimilarManhwas currentSeries={effectiveSeries || series} />

      {/* Botón fijo en móvil - SIEMPRE VISIBLE si hay capítulos */}
      {series?.chapters?.length > 0 && (
        <div className={styles.mobileReadBar}>
          <div className={styles.mobileActions}>
            <button
              onClick={handleToggleFavorite}
              className={`${styles.mobileAction} ${isFavorite ? styles.active : ''}`}
            >
              <IconHeart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => setIsShareModalOpen(true)}
              className={styles.mobileAction}
            >
              <IconShare size={20} />
            </button>
          </div>
          <Link
            href={`/manhwa/${slug}/capitulo/${
              // Prioridad: último capítulo leído (si existe) > primer capítulo
              lastReadChapter ||
              continueReadingChapter?.number ||
              series.chapters[0]?.number ||
              1
              }`}
            className={styles.mobileReadLink}
          >
            <IconBook size={18} />
            <span>
              {/*
                Lógica del texto:
                - Si está logueado Y tiene progreso: "Continuar Cap. X"
                - Si NO está logueado O NO tiene progreso: "Primer capitulo"
              */}
              {user && hasProgress && lastReadChapter
                ? `Continuar Cap. ${lastReadChapter}`
                : 'Primer capitulo'}
            </span>
          </Link>
        </div>
      )}

      {/* Admin Floating Toolbar */}
      {isAdmin && (
        <div className={styles.adminFab}>
          <button
            onClick={() => setIsEditModalOpen(true)}
            className={styles.editButton}
            title="Editar serie"
          >
            <IconEdit size={16} />
            <span>Editar</span>
          </button>
          <button className={styles.adminBtn} title="Gestionar capítulos">
            <IconSettings size={16} />
          </button>
          <button className={styles.adminBtn} title="Estadísticas">
            <IconChartBar size={16} />
          </button>
        </div>
      )}

      {/* Modales */}
      <SeriesEditModalV2
        series={series}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setUpdateError('');
        }}
        onSave={handleSaveChanges}
      />

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        series={series}
        slug={slug}
      />

      <AddToListModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        currentStatus={readingStatus}
        onUpdateStatus={handleUpdateStatus}
      />

      {updateError && (
        <div className={styles.errorToast}>
          <IconAlertTriangle size={18} />
          {updateError}
          <button onClick={() => setUpdateError('')}>
            <IconX size={16} />
          </button>
        </div>
      )}
    </main>
  );
}
