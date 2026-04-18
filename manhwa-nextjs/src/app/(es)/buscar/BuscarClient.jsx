'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Badge,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconBook, IconEye, IconSearch } from '@tabler/icons-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/api/client';
import { useLang } from '@/hooks/useLang';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { filterByLanguage } from '@/utils/adultContent';
import styles from './buscar.module.css';

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 24;

const slugifyFallback = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();

const formatViews = (views) => {
  const safe = Number(views) || 0;
  if (safe >= 1000000) return `${(safe / 1000000).toFixed(1)}M`;
  if (safe >= 1000) return `${(safe / 1000).toFixed(1)}K`;
  return String(safe);
};

const getCoverUrl = (item) =>
  normalizeImageUrl(item?.coverUrl || item?.cover_url || item?.cover || '/placeholder-manhwa.jpg');

export default function BuscarClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { lang } = useLang();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [didSearch, setDidSearch] = useState(false);
  const [error, setError] = useState('');

  const texts = useMemo(() => {
    if (lang === 'en') {
      return {
        title: 'Search Manhwas',
        subtitle: 'Conventional search by title or synopsis. No AI engine is used here.',
        placeholder: 'Search by title or synopsis...',
        button: 'Search',
        minChars: 'Enter at least 2 characters to search.',
        noResults: 'No manhwas found for that search.',
        resultsFor: 'Results for',
        chapters: 'chapters',
      };
    }

    return {
      title: 'Buscar Manhwas',
      subtitle: 'Buscador convencional por titulo o sinopsis. Esta vista no usa motor IA.',
      placeholder: 'Buscar por titulo o sinopsis...',
      button: 'Buscar',
      minChars: 'Escribe al menos 2 caracteres para buscar.',
      noResults: 'No se encontraron manhwas para esa busqueda.',
      resultsFor: 'Resultados para',
      chapters: 'caps',
    };
  }, [lang]);

  const performSearch = useCallback(async (raw) => {
    const term = String(raw || '').trim();

    if (term.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setDidSearch(term.length > 0);
      setLoading(false);
      setError(term.length > 0 ? texts.minChars : '');
      return;
    }

    setLoading(true);
    setError('');
    setDidSearch(true);

    try {
      const response = await api.get(
        'series',
        `?search=${encodeURIComponent(term)}&limit=${RESULT_LIMIT}&adult=false&sort=updated_at&order=desc`
      );

      const series = response?.data?.series || [];
      const filtered = filterByLanguage(Array.isArray(series) ? series : [], lang);
      setResults(filtered);
    } catch (err) {
      setResults([]);
      setError(err?.message || (lang === 'en' ? 'Search failed' : 'La busqueda fallo'));
    } finally {
      setLoading(false);
    }
  }, [lang, texts.minChars]);

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim();
    setQuery(q);

    if (!q) {
      setResults([]);
      setDidSearch(false);
      setLoading(false);
      setError('');
      return;
    }

    performSearch(q);
  }, [searchParams, performSearch]);

  const updateUrlWithQuery = useCallback((value) => {
    const params = new URLSearchParams(searchParams.toString());
    const clean = String(value || '').trim();

    if (clean) params.set('q', clean);
    else params.delete('q');

    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [pathname, router, searchParams]);

  const onSubmit = useCallback((event) => {
    event.preventDefault();
    updateUrlWithQuery(query);
  }, [query, updateUrlWithQuery]);

  return (
    <Container size="lg" py="xl">
      <Stack gap="lg">
        <Stack gap={4}>
          <Title order={2} className={styles.pageTitle}>{texts.title}</Title>
          <Text className={styles.pageSubtitle}>{texts.subtitle}</Text>
        </Stack>

        <form onSubmit={onSubmit} className={styles.searchForm}>
          <div className={styles.searchRow}>
            <div className={styles.inputWrapper}>
              <TextInput
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder={texts.placeholder}
                leftSection={<IconSearch size={17} stroke={1.8} />}
                aria-label={texts.placeholder}
                classNames={{
                  input: styles.input,
                  section: styles.section,
                }}
              />
            </div>
            <Button type="submit" className={styles.searchBtn}>
              {texts.button}
            </Button>
          </div>
        </form>

        {loading && (
          <Center py="xl">
            <Loader color="yellow" size="md" />
          </Center>
        )}

        {!loading && error && (
          <Text c="red" size="sm">{error}</Text>
        )}

        {!loading && !error && didSearch && (
          <Text className={styles.resultsLabel}>
            {texts.resultsFor}: <span className={styles.resultsQuery}>{query.trim()}</span>{' '}
            ({results.length})
          </Text>
        )}

        {!loading && !error && didSearch && results.length === 0 && (
          <Text c="dimmed">{texts.noResults}</Text>
        )}

        {!loading && results.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {results.map((item) => {
              const slug = item.slug || slugifyFallback(item.title);

              return (
                <Card
                  key={item.id || slug}
                  padding="sm"
                  className={styles.card}
                  onClick={() => router.push(getLocalizedPath(`/manhwa/${encodeURIComponent(slug)}`, lang))}
                >
                  <Stack gap="sm">
                    <div className={styles.coverWrapper}>
                      <Image
                        src={getCoverUrl(item)}
                        alt={item.title || 'manhwa'}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>

                    <Stack gap={4}>
                      <Text className={styles.cardTitle} lineClamp={2}>{item.title}</Text>
                      <Text size="sm" c="dimmed" lineClamp={3}>
                        {item.synopsis || 'Sinopsis no disponible.'}
                      </Text>
                    </Stack>

                    <Group gap="xs">
                      {item.contentType && (
                        <Badge variant="light" color="yellow">{String(item.contentType).toUpperCase()}</Badge>
                      )}
                      <Badge variant="dot" color="cyan">{item.status || 'ongoing'}</Badge>
                    </Group>

                    <Group gap="md">
                      <Group gap={4}>
                        <IconBook size={14} />
                        <Text className={styles.cardMeta}>{Number(item.chapterCount) || 0} {texts.chapters}</Text>
                      </Group>
                      <Group gap={4}>
                        <IconEye size={14} />
                        <Text className={styles.cardMeta}>{formatViews(item.views)}</Text>
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
