"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Container, Center, Text, Group,
    Stack, Button, Box, Transition, Card, Modal
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { IconBook, IconRefresh } from '@tabler/icons-react';
import Header from '@/components/Header';

// Componente de Paginación personalizado para evitar conflictos con Next.js 15
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
        minWidth: btnSize,
        height: btnSize,
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        fontWeight: isActive ? 600 : 400,
        fontSize: isMobile ? '0.8rem' : '0.875rem',
        backgroundColor: isActive ? `var(--mantine-color-${color}-6)` : 'transparent',
        color: isActive ? 'white' : 'var(--mantine-color-dimmed)',
        transition: 'all 0.2s ease',
    });

    const navButtonStyle = (disabled) => ({
        minWidth: btnSize,
        height: btnSize,
        borderRadius: '50%',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: 'transparent',
        color: disabled ? 'var(--mantine-color-gray-6)' : 'var(--mantine-color-dimmed)',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
    });

    const iconSize = isMobile ? 15 : 18;

    return (
        <Group gap={isMobile ? 2 : 4} wrap="nowrap">
            <button
                style={navButtonStyle(value === 1)}
                onClick={() => value > 1 && onChange(1)}
                disabled={value === 1}
                aria-label="Primera página"
            >
                <IconChevronsLeft size={iconSize} />
            </button>
            <button
                style={navButtonStyle(value === 1)}
                onClick={() => value > 1 && onChange(value - 1)}
                disabled={value === 1}
                aria-label="Página anterior"
            >
                <IconChevronLeft size={iconSize} />
            </button>

            {getVisiblePages().map((page) => (
                <button
                    key={page}
                    style={buttonStyle(page === value)}
                    onClick={() => onChange(page)}
                    aria-label={`Página ${page}`}
                    aria-current={page === value ? 'page' : undefined}
                >
                    {page}
                </button>
            ))}

            <button
                style={navButtonStyle(value === total)}
                onClick={() => value < total && onChange(value + 1)}
                disabled={value === total}
                aria-label="Página siguiente"
            >
                <IconChevronRight size={iconSize} />
            </button>
            <button
                style={navButtonStyle(value === total)}
                onClick={() => value < total && onChange(total)}
                disabled={value === total}
                aria-label="Última página"
            >
                <IconChevronsRight size={iconSize} />
            </button>
        </Group>
    );
}

import classes from './Biblioteca.module.css';
import { PremiumSkeletonGrid } from '../../components/PremiumSkeleton';
import { useSpaces } from '../../hooks/useSpaces';
import { slugifyQuery } from '../../hooks/useIA';
import { normalizeImageUrl } from '../../utils/imageUtils';
import ManhwaCover from '../../components/ManhwaCover';
import dynamic from 'next/dynamic';
const ChatIA = dynamic(() => import('../../components/ia-minicpm'), { ssr: false });
const Donacion = dynamic(() => import('../../components/Donacion'), { ssr: false });

/**
 * BibliotecaClient — Componente cliente para la página de Biblioteca.
 * 
 * Recibe `initialSeries` del Server Component (SSR) para que los
 * crawlers que no ejecutan JavaScript (OpenAI, Perplexity, etc.)
 * vean el contenido completo en el HTML inicial.
 * 
 * Si no hay datos SSR (raro), hace fallback a carga client-side.
 */
export default function BibliotecaClient({ initialSeries = [] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [isInitialLoad, setIsInitialLoad] = useState(initialSeries.length === 0);
    const [navigatingToIA, setNavigatingToIA] = useState(false);
    const [donacionOpen, setDonacionOpen] = useState(false);
    const itemsPerPage = 32;
    const gridTopRef = useRef(null);
    const router = useRouter();

    // 1. Hooks de Datos (IA ya no se usa inline — redirige a /busqueda-ia)

    // Solo usar el hook de Spaces como fallback si no hay datos SSR
    const {
        series: spacesData,
        loading: spacesLoading,
        error: spacesError,
        refresh,
        isFromCache
    } = useSpaces();

    // 2. Memoización de Datos Base
    // Preferir datos SSR sobre datos del hook (más rápido y más fresh para SEO)
    const seriesData = useMemo(() => {
        // Si el hook ya cargó datos frescos, usarlos
        if (spacesData && spacesData.length > 0) return spacesData;
        // Sino usar los datos SSR como fallback confiable
        return initialSeries;
    }, [spacesData, initialSeries]);

    // 3. Lógica de Filtrado
    const searchParams = useSearchParams();
    const querySearch = searchParams.get('search') || '';

    const filteredSeries = useMemo(() => {
        const base = seriesData;

        // Si hay query `search` en la URL, filtrar por título (case-insensitive)
        if (querySearch && querySearch.trim().length > 0) {
            const q = querySearch.trim().toLowerCase();
            return base.filter((s) => (s.title || '').toLowerCase().includes(q));
        }

        return base;
    }, [seriesData, querySearch]);

    // 4. Memoización de Paginación
    // Evita recalcular tajadas de array en cada render si los datos no cambian
    const paginatedSeries = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSeries.slice(start, start + itemsPerPage);
    }, [filteredSeries, currentPage]);

    const totalPages = Math.ceil(filteredSeries.length / itemsPerPage);

    // 5. Manejo de Estados de Carga Progresivo
    // Si tenemos datos SSR, no mostrar skeleton — el contenido ya está en el HTML
    useEffect(() => {
        if (initialSeries.length > 0) {
            setIsInitialLoad(false);
            return;
        }
        if ((seriesData.length > 0 || !spacesLoading) && isInitialLoad) {
            const timer = setTimeout(() => setIsInitialLoad(false), 600);
            return () => clearTimeout(timer);
        }
    }, [seriesData.length, spacesLoading, isInitialLoad, initialSeries.length]);

    // 6. Callbacks Memoizados
    const handleIASearch = useCallback((pregunta) => {
        const slug = slugifyQuery(pregunta);
        setNavigatingToIA(true);
        router.prefetch(`/busqueda-ia/${slug}`);
        router.push(`/busqueda-ia/${slug}`);
    }, [router]);

    const handleClearFilters = useCallback(() => {
        setCurrentPage(1);
    }, []);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
        if (gridTopRef.current) {
            gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    // Solo mostrar skeleton si no hay datos SSR Y el hook está cargando
    const isLoading = isInitialLoad && initialSeries.length === 0;
    const hasError = spacesError && seriesData.length === 0;

    return (
        <Box className={classes.pageWrapper} bg="var(--page-bg)" c="var(--text-color)" mih="100vh">
            <Container size="lg" py="sm" className="siteContainer">
                <Header />

                {/* Skeleton State - solo si no hay datos SSR */}
                {isLoading && (
                    <Stack gap="md">
                        <Group>
                            <IconBook size={24} color="var(--mantine-color-blue-5)" />
                            <Text size="xl" fw={700}>Preparando Biblioteca Imperial...</Text>
                        </Group>
                        <PremiumSkeletonGrid count={8} />
                    </Stack>
                )}

                {/* Cache / Sync Indicator */}
                {!isLoading && isFromCache && (
                    <Transition mounted={isFromCache} transition="fade" duration={400}>
                        {(styles) => (
                            <Group justify="space-between" mb="md" p="xs" bg="var(--subtle-bg)" style={{ ...styles, borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                                <Text size="xs" c="dimmed">📦 Cargado desde memoria local (Offline-first)</Text>
                                <Button
                                    variant="subtle"
                                    size="compact-xs"
                                    leftSection={<IconRefresh size={14} style={{ animation: spacesLoading ? 'spin 2s linear infinite' : 'none' }} />}
                                    onClick={refresh}
                                    loading={spacesLoading}
                                >
                                    Actualizar catálogo
                                </Button>
                            </Group>
                        )}
                    </Transition>
                )}

                {hasError && !isLoading && (
                    <Center py="xl"><Text c="red" fw={500}>No se pudo conectar con el servidor central.</Text></Center>
                )}

                {/* Main Content Area */}
                {!isLoading && !hasError && (
                    <Stack gap="md">
                        {/* IA Search Section — redirige a /busqueda-ia/[query] */}
                        <Stack gap="md">
                            <ChatIA
                                onSearch={handleIASearch}
                                loading={navigatingToIA}
                                explanation={null}
                                onClear={null}
                            />
                        </Stack>
                        {!navigatingToIA && !querySearch && (
                            <button
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
                        )}

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

                        {/* Manhwa Grid */}
                        {paginatedSeries.length > 0 ? (
                            <Stack gap="sm">
                                <Group ref={gridTopRef} justify="space-between">
                                    <Group gap="xs">
                                        <IconBook size={22} className={classes.sectionIcon} />
                                        <Text size="lg" fw={700}>Catálogo Imperial</Text>
                                    </Group>
                                    <Text size="xs" c="dimmed">{filteredSeries.length} títulos disponibles</Text>
                                </Group>

                                <div className={classes.gridReleases}>
                                    {paginatedSeries.map((series, index) => (
                                        <div key={series.slug || series.id} className={classes.releaseCard}>
                                            <Link href={`/manhwa/${series.slug}`} className={classes.releaseCoverContainer}>
                                                <div className={classes.releaseCoverWrapper}>
                                                    {(series.chapterCount || series.totalChapters || (series.chapters || []).length) > 0 && (
                                                        <span className={classes.chapterBadge}>
                                                            {series.chapterCount || series.totalChapters || series.chapters?.length} caps
                                                        </span>
                                                    )}
                                                    <ManhwaCover
                                                        src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
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
                        ) : (
                            <Transition mounted={paginatedSeries.length === 0} transition="pop" duration={400}>
                                {(styles) => (
                                    <Card p="xl" radius="lg" bg="rgba(255,255,255,0.02)" style={{ ...styles, textAlign: 'center', border: '1px dashed var(--border-subtle)' }}>
                                        <Stack align="center" gap="sm">
                                            <Text fw={600}>No hay coincidencias para tu búsqueda</Text>
                                            <Text size="sm" c="dimmed">Prueba con géneros diferentes o una descripción más amplia.</Text>
                                            <Button variant="light" color="cyan" radius="md" onClick={handleClearFilters}>
                                                Reiniciar Biblioteca
                                            </Button>
                                        </Stack>
                                    </Card>
                                )}
                            </Transition>
                        )}
                    </Stack>
                )}
            </Container>
        </Box>
    );
}
