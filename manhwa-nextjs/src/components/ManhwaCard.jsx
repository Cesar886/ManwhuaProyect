import { Card, Badge, Text, Group, Stack, ActionIcon } from '@mantine/core';
import { IconStar, IconEye, IconBook } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import LazyImage from './LazyImage';
import { normalizeImageUrl } from '../utils/imageUtils';
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
    router.push(`/manhwa/${slug}`);
  };

  // Determinar color del badge según estado
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'activo':
      case 'ongoing':
        return 'green';
      case 'hiatus':
        return 'yellow';
      case 'finalizado':
      case 'completed':
        return 'blue';
      case 'cancelado':
        return 'red';
      default:
        return 'gray';
    }
  };

  const statusLabel = manhwa.status === 'ongoing' ? 'Activo' : manhwa.status;

  // SEO: Generar alt text narrativo con keywords y contexto para Visión de IA
  const coverAlt = `Portada oficial del manhwa ${manhwa.title} - Serie de acción en español, ${manhwa.status === 'ongoing' ? 'en emisión' : manhwa.status || 'disponible'} en Manhwa Imperial`;

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
          <div className={classes.stateLabel}>ESTADO 2: Card con datos</div>
        </div>

        {/* Status Badge */}
        <Badge
          className={classes.statusBadge}
          size="xs"
          variant="filled"
          color={getStatusColor(manhwa.status)}
        >
          {statusLabel}
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
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir manhwa a favoritos'}
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
            Leer manhwa
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
                {manhwa.chapterCount} caps
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
            Cap. {manhwa.chapters[0].number} • {manhwa.chapters[0].time || 'Reciente'}
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
