'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowLeft, IconFolder, IconHeartFilled, IconRefresh } from '@tabler/icons-react';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import { useAuth } from '@/contexts/AuthContext';
import { getBookmarks, getCollectionManhwas, getMyCollections } from '@/api/requests';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import styles from './CollectionDetail.module.css';

const FAVORITES_SLUG = '__favorites__';

export default function CollectionDetailClient({ slug, lang = 'es' }) {
  const { user, loading: authLoading, openLogin } = useAuth();
  const [collection, setCollection] = useState(null);
  const [series, setSeries] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const en = lang === 'en';
  const isFavorites = slug === FAVORITES_SLUG;

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    const load = async () => {
      try {
        const [collectionResponse, itemsResponse] = await Promise.all([
          isFavorites ? Promise.resolve(null) : getMyCollections(),
          isFavorites ? getBookmarks({ page: 1, limit: 20 }) : getCollectionManhwas(slug, 1),
        ]);
        if (!active) return;
        const match = isFavorites ? null : collectionResponse?.data?.collections?.find((item) => item.slug === slug);
        if (!isFavorites && !match) throw new Error(en ? 'Collection not found.' : 'Colección no encontrada.');
        setCollection(match);
        setSeries(isFavorites
          ? (itemsResponse?.data?.bookmarks || []).map((bookmark) => bookmark.series)
          : itemsResponse?.data?.manhwas || []);
        setPage(1);
        setPages(itemsResponse?.data?.pagination?.pages || 1);
        setTotal(itemsResponse?.data?.pagination?.total ?? 0);
      } catch (err) {
        if (active) setError(err.message || (en ? 'Could not load this collection.' : 'No se pudo cargar la colección.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [authLoading, user, slug, isFavorites, en]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    setError('');
    try {
      const nextPage = page + 1;
      const response = isFavorites
        ? await getBookmarks({ page: nextPage, limit: 20 })
        : await getCollectionManhwas(slug, nextPage);
      setSeries((current) => [...current, ...(isFavorites
        ? (response?.data?.bookmarks || []).map((bookmark) => bookmark.series)
        : response?.data?.manhwas || [])]);
      setPage(nextPage);
      setPages(response?.data?.pagination?.pages || 1);
      setTotal(response?.data?.pagination?.total ?? total);
    } catch (err) {
      setError(err.message || (en ? 'Could not load more titles.' : 'No se pudieron cargar más obras.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const title = isFavorites ? (en ? 'Favorites' : 'Favoritos') : collection?.name;
  const description = isFavorites
    ? (en ? 'Stories you saved as favorites' : 'Tus obras guardadas como favoritas')
    : collection?.description;

  return (
    <main className={styles.page}>
      <Header lang={lang} />
      <div className={styles.container}>
        <Link className={styles.backLink} href={getLocalizedPath('/mis-colecciones', lang)}>
          <IconArrowLeft size={18} /> {en ? 'My collections' : 'Mis colecciones'}
        </Link>

        {authLoading || loading ? (
          <p className={styles.message}>{en ? 'Loading collection…' : 'Cargando colección…'}</p>
        ) : !user ? (
          <div className={styles.empty}>
            <IconFolder size={36} />
            <h1>{en ? 'Sign in to see this collection' : 'Inicia sesión para ver esta colección'}</h1>
            <button className={styles.primaryButton} type="button" onClick={openLogin}>{en ? 'Sign in' : 'Iniciar sesión'}</button>
          </div>
        ) : !collection && !isFavorites ? (
          <div className={styles.empty} role="alert">{error || (en ? 'Collection not found.' : 'Colección no encontrada.')}</div>
        ) : (
          <>
            <div className={styles.heading}>
              <div className={`${styles.headingIcon} ${isFavorites ? styles.favoriteIcon : ''}`}>
                {isFavorites ? <IconHeartFilled size={30} /> : <IconFolder size={30} />}
              </div>
              <div>
                <span className={styles.eyebrow}>{isFavorites ? (en ? 'DEFAULT COLLECTION' : 'COLECCIÓN PREDETERMINADA') : (en ? 'MY COLLECTION' : 'MI COLECCIÓN')}</span>
                <h1>{title}</h1>
                {description && <p>{description}</p>}
                <span className={styles.count}>{total} {en ? 'titles' : 'obras'}</span>
              </div>
            </div>

            {error && <p className={styles.error} role="alert">{error}</p>}
            {series.length === 0 ? (
              <div className={styles.empty}>
                <IconFolder size={36} />
                <p>{en ? 'No titles in this collection yet.' : 'Esta colección aún no tiene obras.'}</p>
              </div>
            ) : (
              <div className={styles.grid}>
                {series.map((item) => (
                  <Link className={styles.seriesCard} key={item.id} href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}>
                    <div className={styles.cover}>
                      <ManhwaCover src={item} slug={item.slug} alt={en ? `Cover of ${item.title}` : `Portada de ${item.title}`} />
                    </div>
                    <strong>{item.title}</strong>
                    {item.chapterCount > 0 && <span>{item.chapterCount} {en ? 'chapters' : 'capítulos'}</span>}
                  </Link>
                ))}
              </div>
            )}
            {page < pages && (
              <button className={styles.primaryButton} type="button" disabled={loadingMore} onClick={loadMore}>
                <IconRefresh size={17} /> {loadingMore ? (en ? 'Loading…' : 'Cargando…') : (en ? 'Load more' : 'Ver más')}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
}
