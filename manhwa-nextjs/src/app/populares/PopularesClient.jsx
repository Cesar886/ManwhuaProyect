"use client";

import { useState, useMemo } from 'react';
import Link from 'next/link';
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
    Tooltip,
    useMantineColorScheme,
    Center,
    SegmentedControl,
} from '@mantine/core';
import {
    IconTrendingUp,
    IconFlame,
    IconStar,
    IconEye,
    IconArrowUpRight,
    IconHeart,
    IconChartBar,
    IconBookmark,
    IconCalendar,
    IconAward,
    IconListNumbers,
    IconLayoutGrid,
} from '@tabler/icons-react';
import classes from './Populares.module.css';
import { normalizeImageUrl } from '../../utils/imageUtils';
import Header from '@/components/Header';

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatViews = (views) => {
    if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
    if (views >= 1_000)     return `${(views / 1_000).toFixed(1)}K`;
    return String(views);
};

const STATUS_LABELS = {
    ongoing:   { label: 'En curso',    color: 'green' },
    completed: { label: 'Completado',  color: 'blue'  },
    hiatus:    { label: 'Hiatus',      color: 'orange'},
    dropped:   { label: 'Cancelado',   color: 'red'   },
    upcoming:  { label: 'Próximamente',color: 'grape' },
};

// ─── StatsCard ───────────────────────────────────────────────────────────────

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

// ─── RankBadge (medalla para top 3) ─────────────────────────────────────────

const RankBadge = ({ rank }) => {
    if (rank === 1) return <span style={{ fontSize: '1.3rem' }}>🥇</span>;
    if (rank === 2) return <span style={{ fontSize: '1.3rem' }}>🥈</span>;
    if (rank === 3) return <span style={{ fontSize: '1.3rem' }}>🥉</span>;
    return (
        <Text fw={800} size="sm" c="dimmed" style={{ minWidth: 24, textAlign: 'center' }}>
            #{rank}
        </Text>
    );
};

// ─── Componente principal ────────────────────────────────────────────────────

export default function PopularesClient({ initialRankings = [] }) {
    const { colorScheme } = useMantineColorScheme();
    const isDark = colorScheme === 'dark';

    const subtleBg      = 'var(--subtle-bg)';
    const subtleBgHover = 'var(--subtle-bg-hover)';
    const pageBg        = 'var(--page-bg)';
    const textColor     = 'var(--text-color)';

    const [viewMode,   setViewMode]   = useState('grid');
    const [timeFrame,  setTimeFrame]  = useState('total');

    // ── Ordenar según timeFrame ──────────────────────────────────────────────
    const sortedRankings = useMemo(() => {
        const copy = [...initialRankings];

        if (timeFrame === 'monthly') {
            copy.sort((a, b) => b.monthlyViews - a.monthlyViews);
        } else if (timeFrame === 'weekly') {
            copy.sort((a, b) => b.weeklyViews - a.weeklyViews);
        } else if (timeFrame === 'daily') {
            copy.sort((a, b) => b.dailyViews - a.dailyViews);
        } else {
            copy.sort((a, b) => b.views - a.views);
        }

        // Reasignar ranking según el orden actual
        return copy.map((item, i) => ({ ...item, rank: i + 1 }));
    }, [initialRankings, timeFrame]);

    // Vista que se muestra según timeFrame
    const viewsForPeriod = (item) => {
        if (timeFrame === 'monthly') return item.monthlyViews;
        if (timeFrame === 'weekly')  return item.weeklyViews;
        if (timeFrame === 'daily')   return item.dailyViews;
        return item.views;
    };

    // Max views del primer puesto (para barra de progreso)
    const maxViews = sortedRankings.length > 0 ? viewsForPeriod(sortedRankings[0]) : 1;

    // ── Estadísticas globales ────────────────────────────────────────────────
    const stats = useMemo(() => {
        if (!sortedRankings.length) return { totalViews: 0, avgRating: '0.00', totalLikes: 0, totalChapters: 0 };
        return {
            totalViews:    sortedRankings.reduce((s, i) => s + i.views, 0),
            avgRating:     (sortedRankings.reduce((s, i) => s + i.rating, 0) / sortedRankings.length).toFixed(2),
            totalLikes:    sortedRankings.reduce((s, i) => s + i.likes, 0),
            totalChapters: sortedRankings.reduce((s, i) => s + i.chapters, 0),
        };
    }, [sortedRankings]);

    // ── Estado vacío ─────────────────────────────────────────────────────────
    if (!initialRankings.length) {
        return (
            <Box className={classes.pageWrapper} style={{ backgroundColor: pageBg, color: textColor, minHeight: '100vh' }}>
                <Container size="lg" py="xl" className="siteContainer">
                    <Header title="Series Populares" />
                    <Center py={80}>
                        <Stack align="center" gap="md">
                            <IconChartBar size={64} stroke={1} style={{ color: 'var(--accent-cyan, #06b6d4)', opacity: 0.4 }} />
                            <Text size="xl" fw={700}>Sin datos de popularidad aún</Text>
                            <Text c="dimmed" ta="center" maw={400}>
                                Las estadísticas se acumularán conforme los usuarios lean capítulos.
                                ¡Vuelve pronto para ver el ranking!
                            </Text>
                            <Button component={Link} href="/" color="cyan" variant="light">
                                Ir al inicio
                            </Button>
                        </Stack>
                    </Center>
                </Container>
            </Box>
        );
    }

    // ── Top 3 Podio ──────────────────────────────────────────────────────────
    const top3 = sortedRankings.slice(0, 3);

    return (
        <Box
            className={classes.pageWrapper}
            style={{ backgroundColor: pageBg, color: textColor, minHeight: '100vh' }}
        >
            <Container size="lg" py="xl" className="siteContainer">
                <Header title="Series Populares" />

                {/* Encabezado */}
                <Stack gap="xs" mb="xl">
                    <Group gap="xs">
                        <IconTrendingUp size={32} style={{ color: 'rgb(var(--accent-cyan, 6 182 212))' }} />
                        <div>
                            <Text size="xs" c="dimmed" fw={600} tt="uppercase" mb={2}>
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
                </Stack>

                {/* Stats Cards */}
                <SimpleGrid cols={{ base: 2, sm: 2, md: 4 }} spacing="md" mb="xl">
                    <StatsCard label="Total de Vistas"   value={formatViews(stats.totalViews)}   icon={IconEye}      color="cyan"   />
                    <StatsCard label="Rating Promedio"   value={`${stats.avgRating} ⭐`}          icon={IconStar}     color="yellow" />
                    <StatsCard label="Total de Likes"    value={formatViews(stats.totalLikes)}    icon={IconHeart}    color="red"    />
                    <StatsCard label="Capítulos Totales" value={stats.totalChapters.toLocaleString()} icon={IconChartBar} color="blue"   />
                </SimpleGrid>

                {/* ── Podio Top 3 ─────────────────────────────────────────── */}
                <Card
                    radius="lg"
                    p="lg"
                    mb="xl"
                    style={{
                        backgroundColor: subtleBg,
                        border: '1px solid var(--border-color-subtle)',
                        background: isDark
                            ? 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(0,0,0,0) 60%)'
                            : 'linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(255,255,255,0) 60%)',
                    }}
                >
                    <Group gap="xs" mb="md">
                        <IconAward size={20} style={{ color: '#f59e0b' }} />
                        <Text fw={700} size="md">Top 3 del Ranking</Text>
                    </Group>
                    <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                        {top3.map((item) => (
                            <Link key={item.id} href={`/manhwa/${item.slug}`} style={{ textDecoration: 'none' }}>
                                <Card
                                    radius="md"
                                    p={0}
                                    style={{
                                        overflow: 'hidden',
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                                        border: item.rank === 1
                                            ? '2px solid #f59e0b'
                                            : item.rank === 2
                                            ? '2px solid #94a3b8'
                                            : '2px solid #cd7f32',
                                        transition: 'transform 0.2s ease',
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                                >
                                    <div style={{ position: 'relative', height: 160, overflow: 'hidden' }}>
                                        <Image
                                            src={normalizeImageUrl(item.cover)}
                                            alt={`Portada de ${item.title}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)',
                                        }} />
                                        <div style={{ position: 'absolute', top: 8, left: 8 }}>
                                            <RankBadge rank={item.rank} />
                                        </div>
                                    </div>
                                    <Stack gap={4} p="sm">
                                        <Text fw={700} size="sm" lineClamp={1}>{item.title}</Text>
                                        <Group gap={6}>
                                            <IconEye size={13} style={{ color: 'rgb(var(--accent-cyan, 6 182 212))' }} />
                                            <Text size="xs" c="dimmed">{formatViews(item.views)} vistas</Text>
                                        </Group>
                                        <Group gap={6}>
                                            <IconStar size={13} style={{ color: '#f59e0b' }} />
                                            <Text size="xs" c="dimmed">{item.rating.toFixed(1)} / 5</Text>
                                        </Group>
                                    </Stack>
                                </Card>
                            </Link>
                        ))}
                    </SimpleGrid>
                </Card>

                {/* ── Filtros ──────────────────────────────────────────────── */}
                <Card
                    className={classes.filterCard}
                    p="md"
                    radius="lg"
                    mb="xl"
                    style={{ backgroundColor: subtleBg, border: '1px solid var(--border-color-subtle)' }}
                >
                    <Group justify="space-between" wrap="wrap" gap="sm">
                        {/* Período */}
                        <Tabs
                            value={timeFrame}
                            onChange={setTimeFrame}
                            variant="pills"
                            className={classes.tabs}
                        >
                            <Tabs.List>
                                <Tabs.Tab value="total"   leftSection={<IconFlame      size={14} />}>Todo</Tabs.Tab>
                                <Tabs.Tab value="monthly" leftSection={<IconCalendar   size={14} />}>Este Mes</Tabs.Tab>
                                <Tabs.Tab value="weekly"  leftSection={<IconTrendingUp size={14} />}>Esta Semana</Tabs.Tab>
                                <Tabs.Tab value="daily"   leftSection={<IconEye        size={14} />}>Hoy</Tabs.Tab>
                            </Tabs.List>
                        </Tabs>

                        {/* Vista */}
                        <SegmentedControl
                            size="sm"
                            value={viewMode}
                            onChange={setViewMode}
                            data={[
                                { label: <Group gap={4}><IconLayoutGrid size={14} /><span>Grid</span></Group>,   value: 'grid' },
                                { label: <Group gap={4}><IconListNumbers size={14} /><span>Lista</span></Group>, value: 'list' },
                            ]}
                        />
                    </Group>
                </Card>

                {/* ── Vista Grid ───────────────────────────────────────────── */}
                {viewMode === 'grid' && (
                    <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md" mb="xl">
                        {sortedRankings.map((item) => (
                            <Link key={item.id} href={`/manhwa/${item.slug}`} style={{ textDecoration: 'none' }}>
                                <Card
                                    className={classes.rankingCard}
                                    p={0}
                                    radius="lg"
                                    style={{
                                        backgroundColor: subtleBg,
                                        border: '1px solid var(--border-color-subtle)',
                                        overflow: 'hidden',
                                        cursor: 'pointer',
                                    }}
                                >
                                    {/* Portada */}
                                    <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden' }}>
                                        <Image
                                            src={normalizeImageUrl(item.cover)}
                                            alt={`Portada de ${item.title} - #${item.rank} en populares`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />

                                        {/* Gradiente inferior */}
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)',
                                        }} />

                                        {/* Rank */}
                                        <div style={{
                                            position: 'absolute', top: 6, left: 6,
                                            background: 'rgba(0,0,0,0.65)',
                                            borderRadius: 6, padding: '2px 7px',
                                            backdropFilter: 'blur(4px)',
                                        }}>
                                            <RankBadge rank={item.rank} />
                                        </div>

                                        {/* Badges: Hot / New / Trending */}
                                        <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                            {item.isHot      && <Badge size="xs" color="orange" variant="filled">🔥 Hot</Badge>}
                                            {item.isNew      && <Badge size="xs" color="teal"   variant="filled">✨ Nuevo</Badge>}
                                            {item.isTrending && <Badge size="xs" color="violet" variant="filled">📈 Trend</Badge>}
                                        </div>

                                        {/* Rating abajo izquierda */}
                                        <div style={{
                                            position: 'absolute', bottom: 6, left: 6,
                                            background: 'rgba(0,0,0,0.6)',
                                            borderRadius: 6, padding: '2px 6px',
                                            backdropFilter: 'blur(4px)',
                                        }}>
                                            <Text size="xs" fw={700} style={{ color: '#fbbf24' }}>
                                                ⭐ {item.rating.toFixed(1)}
                                            </Text>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <Stack gap={6} p="xs">
                                        <Text fw={700} size="xs" className={classes.rankingTitle} lineClamp={2}>
                                            {item.title}
                                        </Text>

                                        {/* Géneros */}
                                        {item.genres.length > 0 && (
                                            <Group gap={3} wrap="wrap">
                                                {item.genres.slice(0, 2).map((g) => (
                                                    <Badge key={g.slug ?? g.name} size="xs" variant="light" color="cyan" radius="sm">
                                                        {g.name}
                                                    </Badge>
                                                ))}
                                            </Group>
                                        )}

                                        {/* Vistas + Likes */}
                                        <Group gap={4} justify="space-between">
                                            <Tooltip label="Vistas" withArrow>
                                                <Group gap={3}>
                                                    <IconEye size={12} style={{ color: '#06b6d4' }} />
                                                    <Text size="xs">{formatViews(viewsForPeriod(item))}</Text>
                                                </Group>
                                            </Tooltip>
                                            <Tooltip label="Likes" withArrow>
                                                <Group gap={3}>
                                                    <IconHeart size={12} style={{ color: '#ef4444' }} />
                                                    <Text size="xs">{formatViews(item.likes)}</Text>
                                                </Group>
                                            </Tooltip>
                                        </Group>
                                    </Stack>
                                </Card>
                            </Link>
                        ))}
                    </SimpleGrid>
                )}

                {/* ── Vista Lista ──────────────────────────────────────────── */}
                {viewMode === 'list' && (
                    <Stack gap="sm" mb="xl">
                        {sortedRankings.map((item) => {
                            const periodViews  = viewsForPeriod(item);
                            const progressPct  = maxViews > 0 ? Math.round((periodViews / maxViews) * 100) : 0;
                            const statusInfo   = STATUS_LABELS[item.status] ?? { label: item.status, color: 'gray' };

                            return (
                                <Link key={item.id} href={`/manhwa/${item.slug}`} style={{ textDecoration: 'none' }}>
                                    <Card
                                        className={classes.rankingListItem}
                                        p="md"
                                        radius="lg"
                                        style={{
                                            backgroundColor: subtleBg,
                                            border: isDark ? '1px solid rgba(6,182,212,0.2)' : '1px solid rgba(6,182,212,0.12)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Grid gutter="md" align="center">

                                            {/* Rank + Portada */}
                                            <Grid.Col span={{ base: 3, xs: 1 }}>
                                                <Stack align="center" gap={4}>
                                                    <RankBadge rank={item.rank} />
                                                    <div style={{ width: '100%', aspectRatio: '3/4', overflow: 'hidden', borderRadius: 8 }}>
                                                        <Image
                                                            src={normalizeImageUrl(item.cover)}
                                                            alt={`Portada de ${item.title}`}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    </div>
                                                </Stack>
                                            </Grid.Col>

                                            {/* Info principal */}
                                            <Grid.Col span={{ base: 9, xs: 6 }}>
                                                <Stack gap="xs">
                                                    <Group gap="xs" wrap="wrap">
                                                        <Text fw={700} size="md" lineClamp={1}>
                                                            {item.title}
                                                        </Text>
                                                        {item.isHot      && <Badge size="xs" color="orange">🔥 Hot</Badge>}
                                                        {item.isNew      && <Badge size="xs" color="teal">✨ Nuevo</Badge>}
                                                        {item.isTrending && <Badge size="xs" color="violet">📈 Trend</Badge>}
                                                    </Group>

                                                    <Group gap="xs" wrap="wrap">
                                                        <Badge size="sm" color={statusInfo.color} variant="light">
                                                            {statusInfo.label}
                                                        </Badge>
                                                        <Badge size="sm" color="cyan">
                                                            {item.chapters} Cap.
                                                        </Badge>
                                                        <Badge size="sm" variant="light" color="yellow">
                                                            ⭐ {item.rating.toFixed(1)}
                                                        </Badge>
                                                        {item.genres.slice(0, 2).map((g) => (
                                                            <Badge key={g.slug ?? g.name} size="sm" variant="outline" color="gray">
                                                                {g.name}
                                                            </Badge>
                                                        ))}
                                                    </Group>

                                                    {item.synopsis && (
                                                        <Text size="xs" c="dimmed" lineClamp={2}>
                                                            {item.synopsis}
                                                        </Text>
                                                    )}

                                                    {/* Barra de popularidad (relativa al #1) */}
                                                    <div>
                                                        <Group justify="space-between" mb={3}>
                                                            <Text size="xs" c="dimmed">Popularidad relativa</Text>
                                                            <Text size="xs" fw={600}>{progressPct}%</Text>
                                                        </Group>
                                                        <Progress
                                                            value={progressPct}
                                                            color="cyan"
                                                            radius="xl"
                                                            size="sm"
                                                        />
                                                    </div>
                                                </Stack>
                                            </Grid.Col>

                                            {/* Stats + Botón */}
                                            <Grid.Col span={{ base: 12, xs: 5 }}>
                                                <Stack gap="sm">
                                                    <SimpleGrid cols={2} spacing="xs">
                                                        <Tooltip label="Vistas en el período" withArrow>
                                                            <Stack gap={2} p="xs" align="center" style={{
                                                                backgroundColor: isDark ? 'rgba(6,182,212,0.1)' : 'rgba(6,182,212,0.07)',
                                                                borderRadius: 8,
                                                            }}>
                                                                <IconEye size={16} style={{ color: '#06b6d4' }} />
                                                                <Text size="xs" fw={600}>{formatViews(periodViews)}</Text>
                                                                <Text size="xs" c="dimmed">Vistas</Text>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip label="Total de likes" withArrow>
                                                            <Stack gap={2} p="xs" align="center" style={{
                                                                backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.07)',
                                                                borderRadius: 8,
                                                            }}>
                                                                <IconHeart size={16} style={{ color: '#ef4444' }} />
                                                                <Text size="xs" fw={600}>{formatViews(item.likes)}</Text>
                                                                <Text size="xs" c="dimmed">Likes</Text>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip label="Favoritos / Bookmarks" withArrow>
                                                            <Stack gap={2} p="xs" align="center" style={{
                                                                backgroundColor: isDark ? 'rgba(234,179,8,0.1)' : 'rgba(234,179,8,0.07)',
                                                                borderRadius: 8,
                                                            }}>
                                                                <IconBookmark size={16} style={{ color: '#eab308' }} />
                                                                <Text size="xs" fw={600}>{formatViews(item.likes)}</Text>
                                                                <Text size="xs" c="dimmed">Guardado</Text>
                                                            </Stack>
                                                        </Tooltip>
                                                        <Tooltip label="Capítulos disponibles" withArrow>
                                                            <Stack gap={2} p="xs" align="center" style={{
                                                                backgroundColor: isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.07)',
                                                                borderRadius: 8,
                                                            }}>
                                                                <IconChartBar size={16} style={{ color: '#6366f1' }} />
                                                                <Text size="xs" fw={600}>{item.chapters}</Text>
                                                                <Text size="xs" c="dimmed">Caps.</Text>
                                                            </Stack>
                                                        </Tooltip>
                                                    </SimpleGrid>

                                                    <Button
                                                        color="cyan"
                                                        variant="filled"
                                                        size="xs"
                                                        fullWidth
                                                        component={Link}
                                                        href={`/manhwa/${item.slug}`}
                                                        leftSection={<IconArrowUpRight size={14} />}
                                                    >
                                                        Leer ahora
                                                    </Button>
                                                </Stack>
                                            </Grid.Col>

                                        </Grid>
                                    </Card>
                                </Link>
                            );
                        })}
                    </Stack>
                )}
            </Container>
        </Box>
    );
}
