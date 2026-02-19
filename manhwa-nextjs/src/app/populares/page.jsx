"use client";

import { useState, useMemo, useEffect } from 'react';
import {
  Container,
  Grid,
  Card,
  Image,
  Text,
  Badge,
  Group,
  Stack,
  Button,
  Box,
  Progress,
  Tabs,
  SimpleGrid,
  ThemeIcon,
  RingProgress,
  Tooltip,
  useMantineColorScheme,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconTrendingUp,
  IconFlame,
  IconStar,
  IconEye,
  IconArrowUpRight,
  IconArrowDownRight,
  IconHeart,
  IconChartBar,
} from '@tabler/icons-react';
import classes from './Populares.module.css';
import { getPopularSeries } from '../../api/requests';
import { normalizeImageUrl } from '../../utils/imageUtils';
import ManhwaCover from '../../components/ManhwaCover';
import Header from '@/components/Header';

// Función para formatear números
const formatViews = (views) => {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
};

// Componente de estadísticas
const StatsCard = ({ label, value, icon: Icon, color }) => (
  <Card className={classes.statsCard} p="md" radius="lg">
    <Group justify="space-between" align="flex-start">
      <Stack gap={4}>
        <Text size="xs" c="dimmed" fw={600} tt="uppercase">
          {label}
        </Text>
        <Text fw={700} size="lg">
          {value}
        </Text>
      </Stack>
      <ThemeIcon size="lg" variant="light" color={color} radius="md">
        {Icon && <Icon size={20} stroke={1.5} />}
      </ThemeIcon>
    </Group>
  </Card>
);

export default function Popular() {
  const mantine = useMantineColorScheme();
  const isDark = mantine.colorScheme === 'dark';
  const subtleBg = 'var(--subtle-bg)';
  const subtleBgHover = 'var(--subtle-bg-hover)';
  const pageBg = 'var(--page-bg)';
  const textColor = 'var(--text-color)';
  const [viewMode, setViewMode] = useState('grid'); // grid o list
  const [timeFrame, setTimeFrame] = useState('total'); // total o monthly
  const [rankingsData, setRankingsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar datos de la API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Cargar series populares
        const response = await getPopularSeries({ limit: 20 });
        const popularSeries = response.data?.series || [];

        // Mapear datos a formato esperado
        const mappedData = popularSeries.map((series, index) => ({
          id: series.id,
          rank: index + 1,
          title: series.title,
          // API devuelve `coverUrl`; mantener compatibilidad con `cover` o `cover_url`
          cover: series.coverUrl || series.cover || series.cover_url || 'https://picsum.photos/seed/default/300/400',
          // Vistas totales / periodo
          views: series.totalViews ?? series.view_count ?? series.views ?? 0,
          monthlyViews: series.periodViews ?? series.monthlyViews ?? 0,
          // Rating
          rating: series.rating ?? series.rating_average ?? 0,
          // Likes no siempre está disponible; usar bookmarkCount como aproximación si existe
          likes: series.likesCount ?? series.bookmarkCount ?? 0,
          chapters: series.chapterCount ?? series.totalChapters ?? 0,
          trend: 'up', // Podríamos calcularlo después
          trendValue: 0,
        }));

        setRankingsData(mappedData);
      } catch (err) {
        console.error('Error loading popular series:', err);
        setError('Error al cargar las series populares.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Datos ordenados
  const sortedRankings = useMemo(() => {
    return [...rankingsData].sort((a, b) => a.rank - b.rank);
  }, [rankingsData]);

  // Estadísticas generales
  const stats = useMemo(() => {
    return {
      totalViews: sortedRankings.reduce((sum, item) => sum + item.views, 0),
      avgRating: (
        sortedRankings.reduce((sum, item) => sum + item.rating, 0) / sortedRankings.length
      ).toFixed(2),
      totalLikes: sortedRankings.reduce((sum, item) => sum + item.likes, 0),
      totalChapters: sortedRankings.reduce((sum, item) => sum + item.chapters, 0),
    };
  }, [sortedRankings]);

  return (
    <Box
      className={classes.pageWrapper}
      style={{
        backgroundColor: pageBg,
        color: textColor,
        minHeight: '100vh',
      }}
    >
      <Container size="lg" py="xl" className="siteContainer">
        <Header title="Series Populares" />
        <Stack gap="lg" mb="xl">
          <div>
            <Group gap="xs" mb="xs">
              <IconTrendingUp size={32} style={{ color: 'rgb(var(--accent-cyan))' }} />
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb="xs">
                  Ranking de Series
                </Text>
                <Text size="xl" fw={700}>
                  Series Más Populares
                </Text>
              </div>
            </Group>
            <Text size="sm" c="dimmed">
              Descubre las series más vistas y mejor valoradas por nuestra comunidad
            </Text>
          </div>
        </Stack>

        {/* Loading State */}
        {loading && (
          <Center py="xl">
            <Stack align="center" gap="md">
              <Loader size="lg" />
              <Text c="dimmed">Cargando series populares...</Text>
            </Stack>
          </Center>
        )}

        {/* Error State */}
        {error && !loading && (
          <Center py="xl">
            <Text c="red">{error}</Text>
          </Center>
        )}

        {/* Content - Only show when not loading and no error */}
        {!loading && !error && (
          <>
            {/* Statistics Cards */}
            <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="md" mb="xl">
              <StatsCard
                label="Total de Vistas"
                value={formatViews(stats.totalViews)}
                icon={IconEye}
                color="cyan"
              />
              <StatsCard
                label="Rating Promedio"
                value={`${stats.avgRating}⭐`}
                icon={IconStar}
                color="yellow"
              />
              <StatsCard
                label="Total de Likes"
                value={formatViews(stats.totalLikes)}
                icon={IconHeart}
                color="red"
              />
              <StatsCard
                label="Capítulos Totales"
                value={stats.totalChapters}
                icon={IconChartBar}
                color="blue"
              />
            </SimpleGrid>

            {/* Time Frame & View Mode Tabs */}
            <Card
              className={classes.filterCard}
              p="md"
              radius="lg"
              mb="xl"
              style={{
                backgroundColor: subtleBg,
                border: '1px solid var(--border-color-subtle)',
              }}
            >
              <Group justify="space-between" wrap="wrap">
                <Tabs
                  value={timeFrame}
                  onChange={setTimeFrame}
                  variant="pills"
                  defaultValue="total"
                  className={classes.tabs}
                >
                  <Tabs.List>
                    <Tabs.Tab value="total" leftSection={<IconFlame size={14} />}>
                      Total
                    </Tabs.Tab>
                    <Tabs.Tab value="monthly" leftSection={<IconTrendingUp size={14} />}>
                      Este Mes
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs>

                <Group gap="xs">
                  <Button
                    variant={viewMode === 'grid' ? 'filled' : 'light'}
                    size="sm"
                    color="cyan"
                    onClick={() => setViewMode('grid')}
                  >
                    Vista Grid
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'filled' : 'light'}
                    size="sm"
                    color="cyan"
                    onClick={() => setViewMode('list')}
                  >
                    Vista Lista
                  </Button>
                </Group>
              </Group>
            </Card>

            {/* Rankings Grid View */}
            {viewMode === 'grid' && (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg" mb="xl">
                {sortedRankings.map((item) => (
                  <Card
                    key={item.id}
                    className={classes.rankingCard}
                    p={0}
                    radius="lg"
                    style={{
                      backgroundColor: subtleBg,
                      border: '1px solid var(--border-color-subtle)',
                      transition: 'all 0.3s ease',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = subtleBgHover;
                      e.currentTarget.style.borderColor = 'var(--accent-cyan-0-4)';
                      e.currentTarget.style.transform = 'translateY(-8px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = subtleBg;
                      e.currentTarget.style.borderColor = isDark ? 'var(--accent-cyan-0-2)' : 'var(--accent-cyan-0-1)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Badge de Rank */}
                    <div
                      style={{
                        position: 'relative',
                        height: '200px',
                        overflow: 'hidden',
                      }}
                    >
                      <Image
                        src={normalizeImageUrl(item.cover)}
                        alt={item.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />

                      {/* Rank Badge */}
                      {/* Rank removed as requested */}

                      {/* Trend Badge */}
                      <Badge
                        size="lg"
                        variant="filled"
                        color={item.trend === 'up' ? 'green' : 'red'}
                        leftSection={
                          item.trend === 'up' ? (
                            <IconArrowUpRight size={12} />
                          ) : (
                            <IconArrowDownRight size={12} />
                          )
                        }
                        style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                        }}
                      >
                        {Math.abs(item.trendValue)}%
                      </Badge>

                      {/* Rating Overlay */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '0.5rem',
                          left: '0.5rem',
                          backgroundColor: isDark ? 'var(--nav-bg)' : 'var(--subtle-bg-hover)',
                          borderRadius: '0.5rem',
                          padding: '0.5rem',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        <Group gap={2}>
                          <Text size="sm" fw={600} style={{ color: 'rgb(var(--accent-amber))' }}>
                            {item.rating}
                          </Text>
                          <Text size="sm">⭐</Text>
                        </Group>
                      </div>
                    </div>

                    {/* Content */}
                    <Stack gap="xs" p="md">
                      <Text fw={600} size="sm" className={classes.rankingTitle}>
                        {item.title}
                      </Text>

                      {/* Stats */}
                      <Group gap="xs" grow>
                        <Tooltip label="Vistas totales" withArrow position="bottom">
                          <Group gap={4} p="xs" style={{
                            backgroundColor: isDark ? 'var(--accent-cyan-0-1)' : 'var(--accent-cyan-0-2)',
                            borderRadius: '0.5rem',
                          }}>
                            <IconEye size={14} style={{ color: 'rgb(var(--accent-cyan))' }} />
                            <Text size="xs">{formatViews(item.views)}</Text>
                          </Group>
                        </Tooltip>
                        <Tooltip label="Total de likes" withArrow position="bottom">
                          <Group gap={4} p="xs" style={{
                            backgroundColor: isDark ? 'var(--accent-red-0-3)' : 'var(--accent-red-0-2)',
                            borderRadius: '0.5rem',
                          }}>
                            <IconHeart size={14} style={{ color: 'rgb(var(--accent-red))' }} />
                            <Text size="xs">{formatViews(item.likes)}</Text>
                          </Group>
                        </Tooltip>
                      </Group>

                      <Button
                        color="cyan"
                        variant="light"
                        size="xs"
                        fullWidth
                        onClick={() => { /* TODO: abrir detalle de la serie */ }}
                      >
                        Ver Detalles
                      </Button>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            )}

            {/* Rankings List View */}
            {viewMode === 'list' && (
              <Stack gap="md" mb="xl">
                {sortedRankings.map((item) => (
                  <Card
                    key={item.id}
                    className={classes.rankingListItem}
                    p="md"
                    radius="lg"
                    style={{
                      backgroundColor: subtleBg,
                      border: isDark ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid rgba(6, 182, 212, 0.12)',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = subtleBgHover;
                      e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = subtleBg;
                      e.currentTarget.style.borderColor = isDark ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.12)';
                    }}
                  >
                    <Grid gutter="lg" align="stretch">
                      {/* Rank column removed as requested */}

                      {/* Cover Column */}
                      <Grid.Col span={{ base: 12, xs: 2 }}>
                        <Image
                          src={normalizeImageUrl(item.cover)}
                          alt={item.title}
                          style={{
                            borderRadius: '0.75rem',
                            height: '100%',
                            aspectRatio: '3/4',
                            objectFit: 'cover',
                          }}
                        />
                      </Grid.Col>

                      {/* Info Column */}
                      <Grid.Col span={{ base: 12, xs: 5 }}>
                        <Stack gap="md" h="100%" justify="space-between">
                          <div>
                            <Text fw={700} size="lg" mb="xs">
                              {item.title}
                            </Text>
                            <Group gap="xs" mb="xs">
                              <Badge size="sm" color="cyan">
                                {item.chapters} Cap
                              </Badge>
                              <Badge size="sm" variant="light" color="yellow">
                                {item.rating}⭐
                              </Badge>
                            </Group>
                            <Text size="sm" c="dimmed">
                              {item.monthlyViews > 0 && `${formatViews(item.monthlyViews)} vistas este mes`}
                            </Text>
                          </div>

                          {/* Progress Bar */}
                          <div>
                            <Group justify="space-between" mb={4}>
                              <Text size="xs" c="dimmed">
                                Progreso de Popularidad
                              </Text>
                              <Text size="xs" fw={600}>
                                {((item.rank / 15) * 100).toFixed(0)}%
                              </Text>
                            </Group>
                            <Progress
                              value={(item.rank / 15) * 100}
                              color="cyan"
                              radius="md"
                              size="sm"
                            />
                          </div>
                        </Stack>
                      </Grid.Col>

                      {/* Stats Column */}
                      <Grid.Col span={{ base: 12, xs: 4 }}>
                        <Stack gap="md" h="100%" justify="space-between">
                          <Group grow>
                            <Tooltip label="Vistas totales" withArrow position="bottom">
                              <Stack gap={2} p="xs" style={{
                                backgroundColor: 'var(--accent-cyan-0-1)',
                                borderRadius: '0.5rem',
                                textAlign: 'center',
                              }}>
                                <IconEye size={18} style={{ color: 'rgb(var(--accent-cyan))' }} />
                                <Text size="xs" fw={600}>
                                  {formatViews(item.views)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Vistas
                                </Text>
                              </Stack>
                            </Tooltip>
                            <Tooltip label="Total de likes" withArrow position="bottom">
                              <Stack gap={2} p="xs" style={{
                                backgroundColor: 'var(--accent-red-0-1)',
                                borderRadius: '0.5rem',
                                textAlign: 'center',
                              }}>
                                <IconHeart size={18} style={{ color: 'rgb(var(--accent-red))' }} />
                                <Text size="xs" fw={600}>
                                  {formatViews(item.likes)}
                                </Text>
                                <Text size="xs" c="dimmed">
                                  Likes
                                </Text>
                              </Stack>
                            </Tooltip>
                          </Group>

                          {/* Trend */}
                          <Badge
                            size="lg"
                            variant="filled"
                            color={item.trend === 'up' ? 'green' : 'red'}
                            leftSection={
                              item.trend === 'up' ? (
                                <IconArrowUpRight size={12} />
                              ) : (
                                <IconArrowDownRight size={12} />
                              )
                            }
                            fullWidth
                          >
                            {item.trend === 'up' ? 'Subiendo' : 'Bajando'} {Math.abs(item.trendValue)}%
                          </Badge>
                        </Stack>
                      </Grid.Col>

                      {/* Action Column */}
                      <Grid.Col span={{ base: 12, xs: 2 }}>
                        <Button
                          color="cyan"
                          variant="filled"
                          size="md"
                          fullWidth
                          h="100%"
                          onClick={() => { /* TODO: abrir detalle de la serie */ }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          Ver
                        </Button>
                      </Grid.Col>
                    </Grid>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}
      </Container>
    </Box>
  );
}