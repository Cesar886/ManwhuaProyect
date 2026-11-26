'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import { useAuth } from '@/contexts/AuthContext';
import { copyCollection, getCollection, getCollectionManhwas, likeCollection, unlikeCollection, reorderCollection } from '@/api/requests';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import styles from './SharedCollection.module.css';

export default function SharedCollectionClient({ collection: initial, lang = 'es', manage = false }) {
  const en = lang === 'en';
  const { user, openLogin } = useAuth();
  const [collection, setCollection] = useState(initial);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getCollection(initial.publicId), getCollectionManhwas(initial.publicId, 1)])
      .then(async ([detail, first]) => {
        if (!active) return;
        setCollection(detail?.data?.collection || initial);
        const firstItems = first?.data?.manhwas || [];
        const totalPages = first?.data?.pagination?.pages || 1;
        if (manage && totalPages > 1) {
          const other = await Promise.all(Array.from({ length: totalPages - 1 }, (_, i) => getCollectionManhwas(initial.publicId, i + 2)));
          if (!active) return;
          setItems([...firstItems, ...other.flatMap(result => result?.data?.manhwas || [])]);
          setPage(totalPages);
        } else {
          setItems(firstItems);
          setPage(1);
        }
        setPages(totalPages);
      })
      .catch(err => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initial, user?.id, manage]);

  const loadMore = async () => {
    if (busy || page >= pages) return;
    setBusy(true);
    try {
      const response = await getCollectionManhwas(collection.publicId, page + 1);
      setItems(current => [...current, ...(response?.data?.manhwas || [])]);
      setPage(page + 1);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const toggleLike = async () => {
    if (!user) return openLogin();
    if (busy) return;
    setBusy(true);
    try {
      const response = collection.userInteraction?.isLiked
        ? await unlikeCollection(collection.publicId)
        : await likeCollection(collection.publicId);
      setCollection(current => ({ ...current,
        likesCount: response.data.likesCount,
        userInteraction: { ...current.userInteraction, isLiked: response.data.isLiked },
      }));
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!user) return openLogin();
    if (busy) return;
    setBusy(true);
    try {
      const response = await copyCollection(collection.publicId);
      window.location.assign(`${getLocalizedPath('/mis-colecciones', lang)}/${response.data.collection.publicId}`);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems(current => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  };

  const saveOrder = async () => {
    setBusy(true);
    try {
      await reorderCollection(collection.publicId, items.map(item => item.id));
      setDirty(false);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <main className={styles.page}>
    <Header lang={lang} />
    <div className={styles.container}>
      {manage && <Link href={getLocalizedPath('/mis-colecciones', lang)}>{en ? 'My collections' : 'Mis colecciones'}</Link>}
      <div className={styles.heading}>
        <div>
          <span className={styles.kicker}>{collection.type === 'favorites' ? (en ? 'Favorites' : 'Favoritos') : (en ? 'Collection' : 'Colección')}</span>
          <h1>{collection.name}</h1>
          {collection.description && <p>{collection.description}</p>}
          <p>{collection.manhwasCount} {en ? 'titles' : 'obras'} · {collection.likesCount} likes</p>
          {collection.creator && <Link href={`/users/${encodeURIComponent(collection.creator.username)}`}>@{collection.creator.username}</Link>}
          {collection.copiedFrom && <p>{en ? 'Copied from' : 'Copiada de'} <Link href={collection.copiedFrom.type === 'favorites'
            ? getLocalizedPath(`/u/${encodeURIComponent(collection.copiedFrom.username)}/favoritos`, lang)
            : getLocalizedPath(`/coleccion/${collection.copiedFrom.publicId}-${collection.copiedFrom.slug}`, lang)}>@{collection.copiedFrom.username}</Link></p>}
        </div>
        <div className={styles.actions}>
          <button type="button" onClick={toggleLike} disabled={busy} aria-pressed={Boolean(collection.userInteraction?.isLiked)}>
            {collection.userInteraction?.isLiked ? '♥' : '♡'} {en ? 'Like' : 'Me gusta'}
          </button>
          <button type="button" onClick={copy} disabled={busy}>{en ? 'Copy collection' : 'Copiar colección'}</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)}>{en ? 'Copy link' : 'Copiar enlace'}</button>
        </div>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {loading ? <p>{en ? 'Loading…' : 'Cargando…'}</p> : items.length ? <>
        <div className={styles.grid}>{items.map((item, index) => <article className={styles.card} key={item.id}>
          <Link href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}>
            <div className={styles.cover}><ManhwaCover src={item} slug={item.slug} alt={item.title} /></div>
            <strong>{item.title}</strong>
          </Link>
          {manage && <div className={styles.order}>
            <button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={en ? `Move ${item.title} up` : `Subir ${item.title}`}>↑</button>
            <button type="button" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)} aria-label={en ? `Move ${item.title} down` : `Bajar ${item.title}`}>↓</button>
          </div>}
        </article>)}</div>
        {page < pages && <button type="button" disabled={busy} onClick={loadMore}>{en ? 'Load more' : 'Ver más'}</button>}
        {manage && dirty && <button type="button" disabled={busy} onClick={saveOrder}>{en ? 'Save order' : 'Guardar orden'}</button>}
      </> : <p>{en ? 'No titles yet.' : 'Aún no hay obras.'}</p>}
    </div>
  </main>;
}
