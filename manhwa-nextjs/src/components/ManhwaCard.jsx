import { Card, Badge, Text, Group, Stack, ActionIcon } from '@mantine/core';
import { IconStar, IconEye, IconBook } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import LazyImage from './LazyImage';
import { normalizeImageUrl } from '../utils/imageUtils';
import { useLang } from '../hooks/useLang';
import { getLocalizedPath } from '../utils/i18nRoutes';
import { getTranslations } from '../i18n/translations';
import classes from './ManhwaCard.module.css';

/**
 * ManhwaCard - Card con carga progresiva en 3 estados
 * 
 * Estados visuales:
 * 1. Skeleton (manejado por ManhwaCardSkeleton)
 * 2. Card con datos (sin imagen todavía) - placeholder colorido
 * 3. Card completa (imagen cargada) - transición suave
 */
export default function ManhwaCard({
  manhwa,
  onFavoriteToggle,
  isFavorite = false,
  animationDelay = 0
}) {
  const router = useRouter();
  const { lang } = useLang();
  const t = getTranslations(lang).manhwaCard;

  // Generar slug seguro
  const slugify = (str) =>
    String(str)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase();

  const handleClick = () => {
    const slug = encodeURIComponent(slugify(manhwa.title));
    // Navegar al detalle de la serie (ruta centralizada en /manhwa/:slug)
    router.push(getLocalizedPath(`/manhwa/${slug}`, lang));
  };

  // Determinar color del badge según tipo de contenido
  const getTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'manhwa':
        return 'pink';
      case 'manhua':
        return 'orange';
      case 'manga':
        return 'violet';
      default:
        return 'pink';
    }
  };

  const contentType = manhwa.contentType || manhwa.content_type || 'manhwa';
  const typeLabel = contentType.charAt(0).toUpperCase() + contentType.slice(1).toLowerCase();

  // SEO: Alt text dinámico con género real de la obra (no hardcodeado)
  const genres = manhwa.genres?.map(g => typeof g === 'string' ? g : g?.name).filter(Boolean) || []
  const genreText = genres.length > 0 ? genres.slice(0, 2).join(` ${t.and} `) : typeLabel.toLowerCase()
  const statusText = manhwa.status === 'ongoing'
    ? t.statusOngoing
    : manhwa.status === 'completed'
      ? t.statusCompleted
      : t.statusAvailable
  const coverAlt = t.coverAltTpl
    .replace('{type}', lang === 'en' ? typeLabel : typeLabel.toLowerCase())
    .replace('{title}', manhwa.title)
    .replace('{genres}', genreText)
    .replace('{status}', statusText);

  return (
    <Card
      className={classes.manhwaCard}
      p={0}
      radius="lg"
      onClick={handleClick}
      style={{
        animationDelay: `${animationDelay}ms`
      }}
    >
      {/* Cover con LazyImage - SEO: alt incluye "manhwa" */}
      <div className={classes.coverWrapper}>
        <LazyImage
          src={normalizeImageUrl(manhwa.cover || manhwa.coverUrl || manhwa.cover_url)}
          alt={coverAlt}
          className={classes.coverImage}
          aspectRatio="3/4"
          forceShowPlaceholder={true}
        />

        {/* Indicador de estado de carga */}
        <div className={classes.cardStateIndicator}>
          <div className={classes.stateLabel}>{t.stateLabel}</div>
        </div>

        {/* Content Type Badge */}
        <Badge
          className={classes.statusBadge}
          size="xs"
          variant="filled"
          color={getTypeColor(contentType)}
        >
          {typeLabel}
        </Badge>

        {/* Favorite button */}
        <ActionIcon
          size="sm"
          variant="filled"
          color={isFavorite ? 'yellow' : 'gray'}
          onClick={(e) => {
            e.stopPropagation()
            onFavoriteToggle?.(manhwa)
          }}
          aria-label={isFavorite ? t.removeFromFavorites : t.addToFavorites}
          className={classes.favoriteButton}
        >
          <IconStar size={14} fill={isFavorite ? 'currentColor' : undefined} />
        </ActionIcon>

        {/* Rating/Stats overlay */}
        {(manhwa.rating || manhwa.viewCount > 0) && (
          <div className={classes.statsOverlay}>
            {manhwa.rating && (
              <Group gap={4}>
                <IconStar size={12} fill="currentColor" />
                <Text size="xs" fw={600}>{manhwa.rating.toFixed(1)}</Text>
              </Group>
            )}
          </div>
        )}

        {/* Hover overlay - SEO: texto con "manhwa" */}
        <div className={classes.hoverOverlay}>
          <Text size="xs" c="white" ta="center" className={classes.hoverText}>
            {t.readManhwa}
          </Text>
        </div>
      </div>

      {/* Info Section */}
      <Stack gap={4} p="xs" className={classes.infoSection}>
        <Text
          className={classes.title}
          lineClamp={2}
        >
          {manhwa.title}
        </Text>

        <Group gap="xs" className={classes.metaInfo}>
          {manhwa.chapterCount > 0 && (
            <Group gap={4}>
              <IconBook size={12} stroke={1.5} />
              <Text size="xs" c="dimmed">
                {manhwa.chapterCount} {t.chaptersShort}
              </Text>
            </Group>
          )}

          {manhwa.viewCount > 0 && (
            <Group gap={4}>
              <IconEye size={12} stroke={1.5} />
              <Text size="xs" c="dimmed">
                {formatViews(manhwa.viewCount)}
              </Text>
            </Group>
          )}
        </Group>

        {/* Último capítulo */}
        {manhwa.chapters?.length > 0 && (
          <Text size="xs" c="cyan" className={classes.latestChapter}>
            {t.chapterAbbrev} {manhwa.chapters[0].number} • {manhwa.chapters[0].time || t.recent}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

/**
 * Formatea número de vistas
 */
function formatViews(views) {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}
