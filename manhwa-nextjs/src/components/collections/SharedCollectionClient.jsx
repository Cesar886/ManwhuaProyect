'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Avatar } from '@mantine/core';
import {
  IconArrowLeft, IconArrowRight, IconBooks, IconCheck,
  IconCopy, IconHeart, IconHeartFilled, IconLink, IconPencil, IconPhoto,
} from '@tabler/icons-react';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import CollectionEditor from './CollectionEditor';
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
  const [savingOrder, setSavingOrder] = useState(false);
  const savingOrderRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const suppressCardClickRef = useRef(null);
  const [activeMoveId, setActiveMoveId] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!linkCopied) return;
    const timeout = setTimeout(() => setLinkCopied(false), 2500);
    return () => clearTimeout(timeout);
  }, [linkCopied]);

  useEffect(() => {
    if (!activeMoveId) return;
    const dismissMoveControls = (event) => {
      if (event.target.closest('[data-reorder-card]')?.getAttribute('data-reorder-card') !== String(activeMoveId)) setActiveMoveId(null);
    };
    document.addEventListener('pointerdown', dismissMoveControls);
    return () => document.removeEventListener('pointerdown', dismissMoveControls);
  }, [activeMoveId]);

  useEffect(() => () => clearTimeout(longPressTimerRef.current), []);

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
    setError('');
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
    setError('');
    setBusy(true);
    try {
      const response = await copyCollection(collection.publicId);
      window.location.assign(`${getLocalizedPath('/mis-colecciones', lang)}/${response.data.collection.publicId}`);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const copyLink = async () => {
    setError('');
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
    } catch {
      setError(en ? 'Could not copy the link.' : 'No se pudo copiar el enlace.');
    }
  };

  const move = async (index, direction) => {
    const target = index + direction;
    if (busy || savingOrderRef.current || target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    savingOrderRef.current = true;
    setSavingOrder(true);
    setError('');
    setItems(next);
    try {
      await reorderCollection(collection.publicId, next.map(item => item.id));
    } catch (err) {
      setItems(previous);
      setError(err.message || (en ? 'Could not save the order.' : 'No se pudo guardar el orden.'));
    } finally {
      savingOrderRef.current = false;
      setSavingOrder(false);
    }
  };

  const startLongPress = (event, id) => {
    if (suppressCardClickRef.current === id) suppressCardClickRef.current = null;
    if (!manage || event.pointerType !== 'touch') return;
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      setActiveMoveId(id);
      suppressCardClickRef.current = id;
    }, 450);
  };

  const endLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const count = collection.manhwasCount ?? items.length;
  const isLiked = Boolean(collection.userInteraction?.isLiked);

  return <main className={styles.page}>
    <Header lang={lang} />
    <div className={styles.container}>
      {manage && <Link className={styles.backLink} href={getLocalizedPath('/mis-colecciones', lang)}>
        <IconArrowLeft size={17} stroke={1.8} /> {en ? 'My collections' : 'Mis colecciones'}
      </Link>}

      <section className={styles.hero} aria-labelledby="collection-title">
        <div className={styles.heroContent}>
          <span className={styles.kicker}>{collection.type === 'favorites' ? (en ? 'Favorites' : 'Favoritos') : (en ? 'Collection' : 'Colección')}</span>
          <div className={styles.titleRow}>
            <h1 id="collection-title">{collection.name}</h1>
            <div className={styles.meta}>
              <span className={styles.metaPill}><IconBooks size={16} stroke={1.8} /> {count} {en ? 'titles' : 'obras'}</span>
              <span className={styles.metaPill}>{isLiked ? <IconHeartFilled size={16} /> : <IconHeart size={16} stroke={1.8} />} {collection.likesCount ?? 0} {en ? 'likes' : 'me gusta'}</span>
            </div>
          </div>
          {collection.description && <p className={styles.description}>{collection.description}</p>}
          {collection.copiedFrom && <p className={styles.copiedFrom}>{en ? 'Copied from' : 'Copiada de'} <Link href={collection.copiedFrom.type === 'favorites'
            ? getLocalizedPath(`/u/${encodeURIComponent(collection.copiedFrom.username)}/favoritos`, lang)
            : getLocalizedPath(`/coleccion/${collection.copiedFrom.publicId}-${collection.copiedFrom.slug}`, lang)}>@{collection.copiedFrom.username}</Link></p>}
        </div>
        <div className={styles.heroFooter}>
          {collection.creator && <Link className={styles.creator} href={`/users/${encodeURIComponent(collection.creator.username)}`} aria-label={en ? `View ${collection.creator.username}'s profile` : `Ver el perfil de ${collection.creator.username}`}>
            <Avatar src={collection.creator.avatarUrl} name={collection.creator.displayName || collection.creator.username} size={32} radius="xl" alt="" />
            <span className={styles.creatorText}><span className={styles.creatorLabel}>{en ? 'Created by' : 'Creada por'}</span><strong>@{collection.creator.username}</strong></span>
          </Link>}
          <div className={styles.actions}>
          {manage && <button className={`${styles.actionButton} ${styles.editAction}`} type="button" onClick={() => setEditing(true)} aria-label={en ? 'Edit collection' : 'Editar colección'}>
            <IconPencil size={18} stroke={1.8} /> <span className={styles.fullActionLabel}>{en ? 'Edit collection' : 'Editar colección'}</span><span className={styles.mobileActionLabel}>{en ? 'Edit' : 'Editar'}</span>
          </button>}
          <button className={`${styles.actionButton} ${isLiked ? styles.likedButton : ''}`} type="button" onClick={toggleLike} disabled={busy} aria-pressed={isLiked} aria-label={isLiked ? (en ? 'Liked' : 'Te gusta') : (en ? 'Like' : 'Me gusta')}>
            {isLiked ? <IconHeartFilled size={18} /> : <IconHeart size={18} stroke={1.8} />} <span className={styles.fullActionLabel}>{isLiked ? (en ? 'Liked' : 'Te gusta') : (en ? 'Like' : 'Me gusta')}</span><span className={styles.mobileActionLabel}>{isLiked ? (en ? 'Liked' : 'Te gusta') : (en ? 'Like' : 'Gusta')}</span>
          </button>
          <button className={styles.actionButton} type="button" onClick={copy} disabled={busy} aria-label={en ? 'Copy collection' : 'Copiar colección'}>
            <IconCopy size={18} stroke={1.8} /> <span className={styles.fullActionLabel}>{en ? 'Copy collection' : 'Copiar colección'}</span><span className={styles.mobileActionLabel}>{en ? 'Copy' : 'Copiar'}</span>
          </button>
          <button className={styles.actionButton} type="button" onClick={copyLink} aria-label={linkCopied ? (en ? 'Link copied' : 'Enlace copiado') : (en ? 'Copy link' : 'Copiar enlace')}>
            {linkCopied ? <IconCheck size={18} stroke={1.8} /> : <IconLink size={18} stroke={1.8} />}
            <span className={styles.fullActionLabel}>{linkCopied ? (en ? 'Link copied' : 'Enlace copiado') : (en ? 'Copy link' : 'Copiar enlace')}</span><span className={styles.mobileActionLabel}>{linkCopied ? (en ? 'Copied' : 'Copiado') : (en ? 'Link' : 'Enlace')}</span>
          </button>
          </div>
        </div>
      </section>
      {editing && <CollectionEditor
        collection={{ ...collection, previewSeries: collection.previewSeries?.length ? collection.previewSeries : items }}
        lang={lang}
        onClose={() => setEditing(false)}
        onSaved={updated => setCollection(current => ({ ...current, name: updated.name, description: updated.description, coverUrl: updated.coverUrl, visibility: updated.visibility, slug: updated.slug }))}
        onDeleted={() => { window.location.assign(getLocalizedPath('/mis-colecciones', lang)); }}
      />}

      {error && <p role="alert" className={styles.error}>{error}</p>}

      <section className={styles.collectionSection} aria-labelledby="works-title">
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>{en ? 'The collection' : 'La colección'}</span>
            <h2 id="works-title">{en ? 'Titles in this collection' : 'Obras de esta colección'}</h2>
            {manage && items.length > 1 && <p>
              <span className={styles.desktopHint}>{en ? 'Hover over a cover to move it.' : 'Pasa el cursor sobre una portada para moverla.'}</span>
              <span className={styles.mobileHint}>{en ? 'Press and hold a cover to move it.' : 'Mantén pulsada una portada para moverla.'}</span>
            </p>}
          </div>
        </div>

        {loading ? <div className={styles.loading} role="status">{en ? 'Loading titles…' : 'Cargando obras…'}</div> : items.length ? <>
          <div className={styles.collectionGrid}>{items.map((item, index) => <article
            className={`${styles.itemCard} ${activeMoveId === item.id ? styles.moveActive : ''}`}
            key={item.id}
            data-reorder-card={manage ? item.id : undefined}
            onPointerDown={(event) => startLongPress(event, item.id)}
            onPointerUp={endLongPress}
            onPointerCancel={endLongPress}
            onPointerLeave={endLongPress}
            onContextMenu={(event) => { if (activeMoveId === item.id) event.preventDefault(); }}
            onClickCapture={(event) => {
              if (suppressCardClickRef.current === item.id) {
                event.preventDefault();
                event.stopPropagation();
                suppressCardClickRef.current = null;
              }
            }}
          >
            <div className={styles.itemMedia}>
              <Link className={styles.itemLink} href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}>
                <div className={styles.itemCover}>
                  <ManhwaCover src={item} slug={item.slug} alt={item.title} fallbackContent={<span className={styles.coverFallback}><IconPhoto size={32} stroke={1.25} /><span>{item.title}</span></span>} />
                  <span className={styles.positionBadge}>{String(index + 1).padStart(2, '0')}</span>
                </div>
              </Link>
              {manage && <div className={styles.order}>
                <button type="button" disabled={busy || savingOrder || index === 0} onClick={() => move(index, -1)} aria-label={en ? `Move ${item.title} earlier` : `Mover ${item.title} antes`} title={en ? 'Earlier' : 'Antes'}><IconArrowLeft size={15} stroke={1.8} /></button>
                <button type="button" disabled={busy || savingOrder || index === items.length - 1} onClick={() => move(index, 1)} aria-label={en ? `Move ${item.title} later` : `Mover ${item.title} después`} title={en ? 'Later' : 'Después'}><IconArrowRight size={15} stroke={1.8} /></button>
              </div>}
            </div>
            <Link className={`${styles.itemLink} ${styles.itemInfo}`} href={getLocalizedPath(`/manhwa/${item.slug}`, lang)}>
              <strong>{item.title}</strong>
              {item.chapterCount > 0 && <span>{item.chapterCount} {en ? 'chapters' : 'capítulos'}</span>}
            </Link>
          </article>)}</div>
          {page < pages && <div className={styles.moreRow}><button className={styles.moreButton} type="button" disabled={busy} onClick={loadMore}>{busy ? (en ? 'Loading…' : 'Cargando…') : (en ? 'Load more' : 'Ver más obras')}</button></div>}
        </> : <div className={styles.empty}><IconBooks size={34} stroke={1.4} /><p>{en ? 'No titles yet.' : 'Aún no hay obras en esta colección.'}</p></div>}
      </section>
    </div>
  </main>;
}
