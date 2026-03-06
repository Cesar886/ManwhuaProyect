'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Container, Center, Text, Group,
    Stack, Button, Box, Card
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { IconBook, IconArrowLeft, IconRefresh, IconLink, IconCheck } from '@tabler/icons-react';
import Header from '@/components/Header';
import { useIA, slugifyQuery, getOriginalQuery } from '@/hooks/useIA';
import { useSpaces } from '@/hooks/useSpaces';
import { normalizeImageUrl } from '@/utils/imageUtils';
import ManhwaCover from '@/components/ManhwaCover';
import { PremiumSkeletonGrid } from '@/components/PremiumSkeleton';
import { filterNonAdultSeries } from '@/utils/adultContent';
import classes from '../../biblioteca/Biblioteca.module.css';
import homeStyles from '../../home/Home.module.css';
import dynamic from 'next/dynamic';
const ChatIA = dynamic(() => import('@/components/ia-minicpm'), { ssr: false });

const getSeriesChapterCount = (series) => {
    const candidates = [
        series?.chapterCount,
        series?.chapter_count,
        series?.chaptersCount,
        series?.chapters_count,
        series?.totalChapters,
        series?.total_chapters,
        series?.chapter_total,
        series?.latestChapter,
        series?.latest_chapter,
        series?.lastChapter,
        series?.last_chapter,
    ];

    for (const value of candidates) {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            return value;
        }

        if (typeof value === 'string') {
            const text = value.trim();
            if (!text) continue;

            const asNumber = Number(text);
            if (Number.isFinite(asNumber) && asNumber > 0) {
                return asNumber;
            }

            const extracted = text.match(/\d+/);
            if (extracted) {
                const parsed = Number(extracted[0]);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return parsed;
                }
            }
        }
    }

    return 0;
};

const normalizeSlugKey = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';

    const withoutQuery = raw.split('?')[0].split('#')[0];
    const noTrailingSlash = withoutQuery.endsWith('/') ? withoutQuery.slice(0, -1) : withoutQuery;
    const parts = noTrailingSlash.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
};

const normalizeTitleKey = (value) => {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

function CustomPagination({ value, onChange, total, color = "cyan" }) {
    const isMobile = useMediaQuery('(max-width: 600px)');
    const btnSize = isMobile ? 30 : 36;
    const showPages = isMobile ? 3 : 5;

    const getVisiblePages = () => {
        const pages = [];
        let start = Math.max(1, value - Math.floor(showPages / 2));
        let end = Math.min(total, start + showPages - 1);
        if (end - start + 1 < showPages) {
            start = Math.max(1, end - showPages + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    const buttonStyle = (isActive) => ({
        minWidth: btnSize, height: btnSize, borderRadius: '50%', border: 'none',
        cursor: 'pointer', fontWeight: isActive ? 600 : 400,
        fontSize: isMobile ? '0.8rem' : '0.875rem',
        backgroundColor: isActive ? `var(--mantine-color-${color}-6)` : 'transparent',
        color: isActive ? 'white' : 'var(--mantine-color-dimmed)',
        transition: 'all 0.2s ease',
    });

    const navButtonStyle = (disabled) => ({
        minWidth: btnSize, height: btnSize, borderRadius: '50%', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: 'transparent',
        color: disabled ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
        opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease',
    });

    const iconSize = isMobile ? 15 : 18;

    return (
        <Group gap={isMobile ? 2 : 4} wrap="nowrap">
            <button style={navButtonStyle(value === 1)} onClick={() => value > 1 && onChange(1)} disabled={value === 1} aria-label="Primera página">
                <IconChevronsLeft size={iconSize} />
            </button>
            <button style={navButtonStyle(value === 1)} onClick={() => value > 1 && onChange(value - 1)} disabled={value === 1} aria-label="Página anterior">
                <IconChevronLeft size={iconSize} />
            </button>
            {getVisiblePages().map((page) => (
                <button key={page} style={buttonStyle(page === value)} onClick={() => onChange(page)} aria-label={`Página ${page}`} aria-current={page === value ? 'page' : undefined}>
                    {page}
                </button>
            ))}
            <button style={navButtonStyle(value === total)} onClick={() => value < total && onChange(value + 1)} disabled={value === total} aria-label="Página siguiente">
                <IconChevronRight size={iconSize} />
            </button>
            <button style={navButtonStyle(value === total)} onClick={() => value < total && onChange(total)} disabled={value === total} aria-label="Última página">
                <IconChevronsRight size={iconSize} />
            </button>
        </Group>
    );
}

export default function BusquedaIAClient({ querySlug }) {
    const router = useRouter();
    const slugDecoded = decodeURIComponent(querySlug || '');

    // Restaurar página del paginador desde history.state si existe (navegación atrás)
    const [currentPage, setCurrentPage] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.history.state?.iaPage || 1;
        }
        return 1;
    });
    const itemsPerPage = 32;
    const gridTopRef = useRef(null);
    const prevSlugRef = useRef(slugDecoded);

    const {
        buscarConIACached,
        cargando: iaLoading,
        error: iaError,
        resultados,
        limpiar: limpiarIA,
    } = useIA();

    const { series: catalogSeries = [] } = useSpaces();

    // Derivar query: intentar recuperar original del caché, sino humanizar el slug
    const searchQuery = useMemo(() => {
        const original = getOriginalQuery(slugDecoded);
        if (original) return original;
        return slugDecoded.replace(/-/g, ' ');
    }, [slugDecoded]);

    // Buscar cuando cambia el slug (incluye mount inicial y navegación SPA sin desmontaje)
    useEffect(() => {
        if (!searchQuery) return;

        // Detectar cambio de slug (navegación SPA sin desmontaje)
        if (prevSlugRef.current !== slugDecoded) {
            prevSlugRef.current = slugDecoded;
            setCurrentPage(1);
        }

        buscarConIACached(searchQuery);
    }, [slugDecoded, searchQuery, buscarConIACached]);

    const catalogBySlug = useMemo(() => {
        const map = new Map();
        for (const item of catalogSeries) {
            const slugKey = normalizeSlugKey(item?.slug);
            if (slugKey) map.set(slugKey, item);
        }
        return map;
    }, [catalogSeries]);

    const catalogById = useMemo(() => {
        const map = new Map();
        for (const item of catalogSeries) {
            if (item?.id !== undefined && item?.id !== null) {
                map.set(String(item.id), item);
            }
        }
        return map;
    }, [catalogSeries]);

    const catalogByTitle = useMemo(() => {
        const map = new Map();
        for (const item of catalogSeries) {
            const titleKey = normalizeTitleKey(item?.title);
            if (titleKey && !map.has(titleKey)) {
                map.set(titleKey, item);
            }
        }
        return map;
    }, [catalogSeries]);

    const iaSeriesEnriched = useMemo(() => {
        const baseSeries = resultados?.series || [];

        return baseSeries.map((series) => {
            const slugKey = normalizeSlugKey(series?.slug);
            const idKey = series?.id !== undefined && series?.id !== null ? String(series.id) : '';
            const titleKey = normalizeTitleKey(series?.title);
            const catalogMatch =
                catalogBySlug.get(slugKey) ||
                (idKey ? catalogById.get(idKey) : null) ||
                (titleKey ? catalogByTitle.get(titleKey) : null);

            if (!catalogMatch) return series;

            const catalogChapterCount = getSeriesChapterCount(catalogMatch);
            const iaChapterCount = getSeriesChapterCount(series);

            return {
                ...catalogMatch,
                ...series,
                chapterCount: catalogChapterCount || iaChapterCount || 0,
                contentType:
                    catalogMatch?.contentType ||
                    catalogMatch?.content_type ||
                    series?.contentType ||
                    series?.content_type ||
                    series?.type ||
                    series?.seriesType ||
                    series?.series_type ||
                    'Manhwa',
            };
        });
    }, [resultados, catalogBySlug, catalogById, catalogByTitle]);

    const filteredSeries = useMemo(() => {
        return filterNonAdultSeries(iaSeriesEnriched);
    }, [iaSeriesEnriched]);

    const paginatedSeries = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSeries.slice(start, start + itemsPerPage);
    }, [filteredSeries, currentPage]);

    const totalPages = Math.ceil(filteredSeries.length / itemsPerPage);

    const handleIASearch = useCallback((pregunta) => {
        const slug = slugifyQuery(pregunta);
        router.push(`/busqueda-ia/${slug}`);
    }, [router]);

    const handleRetry = useCallback(() => {
        if (searchQuery) buscarConIACached(searchQuery);
    }, [searchQuery, buscarConIACached]);

    const handleClearFilters = useCallback(() => {
        limpiarIA();
        router.push('/biblioteca');
    }, [limpiarIA, router]);

    // --- Share button state ---
    const [copied, setCopied] = useState(false);
    const handleShare = useCallback(async () => {
        const url = window.location.href;
        if (navigator.share) {
            try {
                await navigator.share({ title: 'Búsqueda IA - Manhwa Imperial', url });
                return;
            } catch (err) {
                // Si el usuario canceló el diálogo, no hacer nada más
                if (err.name === 'AbortError') return;
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    }, []);

    // --- Preload covers de primeros 4 resultados ---
    useEffect(() => {
        const series = resultados?.series;
        if (!series?.length) return;
        const links = [];
        series.slice(0, 4).forEach(s => {
            const href = normalizeImageUrl(s.cover);
            if (!href) return;
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = href;
            document.head.appendChild(link);
            links.push(link);
        });
        return () => links.forEach(l => l.remove());
    }, [resultados]);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
        // Guardar página en history.state para restaurar al navegar atrás
        if (typeof window !== 'undefined') {
            window.history.replaceState(
                { ...window.history.state, iaPage: page },
                ''
            );
        }
        if (gridTopRef.current) {
            gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    return (
        <Box className={classes.pageWrapper} bg="var(--page-bg)" c="var(--text-color)" mih="100vh">
            <Container size="lg" py="sm" className="siteContainer">
                <Header />

                <Stack gap="md">
                    {/* IA Search Section */}
                    <Stack gap="md">
                        <ChatIA
                            onSearch={handleIASearch}
                            loading={iaLoading}
                            explanation={resultados?.explanation || null}
                            onClear={handleClearFilters}
                            initialQuery={searchQuery}
                        />

                    </Stack>

                    {/* Botón volver al catálogo */}
                    <Group>
                        <Button
                            variant="subtle"
                            color="cyan"
                            size="compact-sm"
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={() => router.push('/biblioteca')}
                        >
                            Volver al catálogo
                        </Button>
                    </Group>

                    {/* Skeleton mientras carga la IA */}
                    {iaLoading && !resultados && (
                        <Stack gap="sm">
                            <Group justify="space-between">
                                <Group gap="xs">
                                    <IconBook size={22} className={classes.sectionIcon} />
                                    <Text size="lg" fw={700}>Buscando resultados...</Text>
                                </Group>
                            </Group>
                            <div className={classes.gridReleases}>
                                <PremiumSkeletonGrid count={8} />
                            </div>
                        </Stack>
                    )}

                    {/* Manhwa Grid */}
                    <div role="region" aria-label="Resultados de búsqueda IA" aria-live="polite">
                    {paginatedSeries.length > 0 ? (
                        <Stack gap="sm">
                            <Group ref={gridTopRef} justify="space-between">
                                <Group gap="xs">
                                    <IconBook size={22} className={classes.sectionIcon} />
                                    <Text size="lg" fw={700}>Resultados Personalizados</Text>
                                </Group>
                                <Group gap="xs">
                                    <Text size="xs" c="dimmed">{filteredSeries.length} títulos encontrados</Text>
                                    <Button
                                        variant="subtle"
                                        color={copied ? 'teal' : 'gray'}
                                        size="compact-xs"
                                        leftSection={copied ? <IconCheck size={13} /> : <IconLink size={13} />}
                                        onClick={handleShare}
                                        style={{ fontSize: '0.7rem' }}
                                    >
                                        {copied ? '¡Enlace copiado!' : 'Compartir'}
                                    </Button>
                                </Group>
                            </Group>

                            <div className={classes.gridReleases}>
                                {paginatedSeries.map((series, index) => (
                                    <div key={series.slug || series.id} className={classes.releaseCard}>
                                        <Link href={`/manhwa/${series.slug}`} className={classes.releaseCoverContainer}>
                                            <div className={classes.releaseCoverWrapper}>
                                                <span className={classes.chapterBadge}>
                                                    {getSeriesChapterCount(series)} caps
                                                </span>
                                                <span className={homeStyles.statusBadge}>
                                                    {series.contentType || series.content_type || series.type || series.seriesType || series.series_type || 'Manhwa'}
                                                </span>
                                                <ManhwaCover
                                                    src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url || series.coverUrlWeb || series.cover_url_web) || ''}
                                                    fallbackSrc={normalizeImageUrl(series.coverUrlWeb || series.cover_url_web || series.cover || series.coverUrl || series.cover_url) || ''}
                                                    slug={series.slug}
                                                    alt={`Portada del manhwa ${series.title} - Leer en español online gratis en Manhwa Imperial`}
                                                    className={classes.popularImg}
                                                    priority={currentPage === 1 && index < 8}
                                                    sizes="(max-width: 480px) 45vw, (max-width: 768px) 30vw, (max-width: 1200px) 22vw, 200px"
                                                />
                                                <div className={classes.releaseOverlay}>
                                                    <h3 className={classes.releaseTitle}>{series.title}</h3>
                                                </div>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <Center mt="xl" mb="xl">
                                    <CustomPagination
                                        value={currentPage}
                                        onChange={handlePageChange}
                                        total={totalPages}
                                        color="cyan"
                                    />
                                </Center>
                            )}
                        </Stack>
                    ) : !iaLoading ? (
                        <Card p="xl" radius="lg" bg="rgba(255,255,255,0.02)" style={{ textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                            <Stack align="center" gap="sm">
                                <Text fw={600}>
                                    {iaError ? 'Hubo un error al buscar' : 'No hay resultados para tu búsqueda'}
                                </Text>
                                <Text size="sm" c="dimmed">Prueba con géneros diferentes o una descripción más amplia.</Text>

                                {!iaError && (
                                    <>
                                        <Text size="xs" c="dimmed" mt="xs">Intenta buscar:</Text>
                                        <Group gap="xs" justify="center" wrap="wrap">
                                            {[
                                                { label: 'Acción OP', slug: 'accion-op' },
                                                { label: 'Romance de época', slug: 'romance-de-epoca' },
                                                { label: 'Murim', slug: 'murim' },
                                                { label: 'Regresión', slug: 'regresion' },
                                                { label: 'BL/Yaoi', slug: 'bl-yaoi' },
                                            ].map(chip => (
                                                <Button
                                                    key={chip.slug}
                                                    variant="light"
                                                    color="violet"
                                                    size="compact-xs"
                                                    radius="xl"
                                                    onClick={() => router.push(`/busqueda-ia/${chip.slug}`)}
                                                    style={{ fontSize: '0.75rem' }}
                                                >
                                                    {chip.label}
                                                </Button>
                                            ))}
                                        </Group>
                                    </>
                                )}

                                <Group gap="xs">
                                    {iaError && (
                                        <Button variant="light" color="cyan" radius="md" leftSection={<IconRefresh size={16} />} onClick={handleRetry}>
                                            Reintentar búsqueda
                                        </Button>
                                    )}
                                    <Button variant="light" color="cyan" radius="md" onClick={handleClearFilters}>
                                        Volver al catálogo
                                    </Button>
                                </Group>
                            </Stack>
                        </Card>
                    ) : null}
                    </div>
                </Stack>
            </Container>
        </Box>
    );
}
