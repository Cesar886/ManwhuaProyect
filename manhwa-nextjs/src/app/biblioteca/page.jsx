"use client";

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Container, Center, Card, Text, Badge, Group,
  Stack, Button, Box, Transition, ActionIcon
} from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from '@tabler/icons-react';
import { IconX, IconBook, IconRefresh, IconSparkles } from '@tabler/icons-react';
import Header from '@/components/Header';

// Componente de Paginación personalizado para evitar conflictos con Next.js 15
function CustomPagination({ value, onChange, total, color = "cyan" }) {
  const getVisiblePages = () => {
    const pages = [];
    const showPages = 5;
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
    minWidth: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    fontWeight: isActive ? 600 : 400,
    backgroundColor: isActive ? `var(--mantine-color-${color}-6)` : 'transparent',
    color: isActive ? 'white' : 'var(--mantine-color-dimmed)',
    transition: 'all 0.2s ease',
  });

  const navButtonStyle = (disabled) => ({
    minWidth: 36,
    height: 36,
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

  return (
    <Group gap={4}>
      <button
        style={navButtonStyle(value === 1)}
        onClick={() => value > 1 && onChange(1)}
        disabled={value === 1}
        aria-label="Primera página"
      >
        <IconChevronsLeft size={18} />
      </button>
      <button
        style={navButtonStyle(value === 1)}
        onClick={() => value > 1 && onChange(value - 1)}
        disabled={value === 1}
        aria-label="Página anterior"
      >
        <IconChevronLeft size={18} />
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
        <IconChevronRight size={18} />
      </button>
      <button
        style={navButtonStyle(value === total)}
        onClick={() => value < total && onChange(total)}
        disabled={value === total}
        aria-label="Última página"
      >
        <IconChevronsRight size={18} />
      </button>
    </Group>
  );
}

import classes from './Biblioteca.module.css';
import { PremiumSkeletonGrid } from '../../components/PremiumSkeleton';
import { useSpaces } from '../../hooks/useSpaces';
import { useIA } from '../../hooks/useIA';
import { normalizeImageUrl } from '../../utils/imageUtils';
import ManhwaCover from '../../components/ManhwaCover';
import ChatIA from '../../components/ia-minicpm';

export default function Series() {
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const itemsPerPage = 32;

  // 1. Hooks de Datos e IA
  const { buscarConIA, cargando: iaLoading, error: iaError, resultados, limpiar: limpiarIA } = useIA();

  const {
    series: spacesData,
    loading: spacesLoading,
    error: spacesError,
    refresh,
    isFromCache
  } = useSpaces();

  // 2. Memoización de Datos Base
  const seriesData = useMemo(() => spacesData || [], [spacesData]);

  // 3. Lógica de Filtrado Optimizada
  // Prioriza resultados de IA si existen, de lo contrario muestra el catálogo
  const searchParams = useSearchParams();
  const querySearch = searchParams.get('search') || '';

  const filteredSeries = useMemo(() => {
    // Si la IA devolvió resultados, priorizarlos
    const base = resultados?.series || seriesData;

    // Si hay query `search` en la URL, filtrar por título (case-insensitive)
    if (querySearch && querySearch.trim().length > 0) {
      const q = querySearch.trim().toLowerCase();
      return base.filter((s) => (s.title || '').toLowerCase().includes(q));
    }

    return base;
  }, [seriesData, resultados, querySearch]);

  // 4. Memoización de Paginación
  // Evita recalcular tajadas de array en cada render si los datos no cambian
  const paginatedSeries = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSeries.slice(start, start + itemsPerPage);
  }, [filteredSeries, currentPage]);

  const totalPages = Math.ceil(filteredSeries.length / itemsPerPage);

  // 5. Manejo de Estados de Carga Progresivo
  useEffect(() => {
    if ((seriesData.length > 0 || !spacesLoading) && isInitialLoad) {
      const timer = setTimeout(() => setIsInitialLoad(false), 600);
      return () => clearTimeout(timer);
    }
  }, [seriesData.length, spacesLoading, isInitialLoad]);

  // 6. Callbacks Memoizados (Evitan re-renders en componentes hijos como ChatIA)
  const handleIASearch = useCallback(async (pregunta) => {
    setCurrentPage(1);
    await buscarConIA(pregunta);
  }, [buscarConIA]);

  const handleClearFilters = useCallback(() => {
    setCurrentPage(1);
    limpiarIA();
  }, [limpiarIA]);

  const isLoading = isInitialLoad;
  const hasError = spacesError && seriesData.length === 0;

  return (
    <Box className={classes.pageWrapper} bg="var(--page-bg)" c="var(--text-color)" mih="100vh">
      <Container size="lg" py="sm" className="siteContainer">
        <Header />

        {/* Skeleton State */}
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
            {/* IA Search Section */}
            <Stack gap="md">
              {/* <ChatIA onSearch={handleIASearch} loading={iaLoading} />  */}

              {/* IA Explanation Panel */}
              {resultados && (
                <Transition mounted={!!resultados} transition="slide-down" duration={300}>
                  {(styles) => (
                    <Card withBorder radius="lg" p="md" style={{ ...styles, borderStyle: 'dashed', borderColor: 'var(--mantine-color-cyan-8)', background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.04) 0%, rgba(0, 150, 255, 0.01) 100%)' }}>
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={4}>
                          <Group gap="xs">
                            <IconSparkles size={16} color="var(--mantine-color-cyan-4)" />
                            <Text size="sm" fw={700} c="cyan">IA Imperial</Text>
                            <Badge variant="light" color="cyan" size="xs">Búsqueda Inteligente</Badge>
                          </Group>
                          {/* Corregido: fs="italic" en lugar de italic */}
                          <Text size="sm" fs="italic" c="dimmed" lh={1.4}>{resultados.explanation}</Text>
                        </Stack>
                        <ActionIcon variant="subtle" color="gray" onClick={handleClearFilters}>
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </Card>
                  )}
                </Transition>
              )}

              {iaError && <Text c="red" size="xs" ta="center">❌ {iaError}</Text>}
            </Stack>

            {/* Manhwa Grid */}
            {paginatedSeries.length > 0 ? (
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconBook size={22} className={classes.sectionIcon} />
                    <Text size="lg" fw={700}>
                      {resultados ? 'Resultados Personalizados' : 'Catálogo Imperial'}
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">{filteredSeries.length} títulos disponibles</Text>
                </Group>

                <div className={classes.gridReleases}>
                  {paginatedSeries.map((series, index) => (
                    <div key={series.slug || series.id} className={classes.releaseCard}>
                      <Link href={`/manhwa/${series.slug}`} className={classes.releaseCoverContainer}>
                        <div className={classes.releaseCoverWrapper}>
                          <ManhwaCover
                            src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                            alt={series.title}
                            className={classes.popularImg}
                            priority={currentPage === 1 && index < 8}
                            sizes="(max-width: 480px) 45vw, (max-width: 768px) 30vw, (max-width: 1200px) 22vw, 200px"
                          />
                          <div className={classes.releaseOverlay}>
                            <h3 className={classes.releaseTitle}>{series.title}</h3>
                          </div>
                        </div>
                      </Link>
                      <div className={classes.releaseInfo}>
                        <div className={classes.chaptersList}>
                          {(series.chapters || []).slice(0, 3).map((ch) => (
                            <Link
                              key={`${series.slug}-${ch.number}`}
                              href={`/manhwa/${series.slug}/capitulo/${ch.number}`}
                              className={classes.chapterLink}
                            >
                              <span>Cap. {ch.number}</span>
                              <span className={classes.chapterTime}>{ch.time}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <Center mt="xl">
                    <CustomPagination
                      value={currentPage}
                      onChange={setCurrentPage}
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