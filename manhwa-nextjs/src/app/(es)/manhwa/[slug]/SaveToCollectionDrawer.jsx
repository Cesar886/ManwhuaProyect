'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Drawer } from '@mantine/core';
import { IconCheck, IconFolder, IconHeart, IconPlus, IconX } from '@tabler/icons-react';
import { addSeriesToCollection, createCollection, getMyCollections, removeSeriesFromCollection } from '@/api/requests';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import styles from './ManhwaDetail.module.css';

export default function SaveToCollectionDrawer({ opened, onClose, seriesId, isFavorite, onSetFavorite, lang = 'es' }) {
  const en = lang === 'en';
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!opened || !seriesId) return;
    let active = true;
    setLoading(true);
    setError('');
    getMyCollections(seriesId)
      .then((response) => {
        if (active) setCollections((response?.data?.collections || []).filter(item => item.type !== 'favorites'));
      })
      .catch((err) => {
        if (active) setError(err.message || (en ? 'Could not load collections.' : 'No se pudieron cargar las colecciones.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [opened, seriesId, en]);

  const toggleCollection = async (collection) => {
    if (busy) return;
    setBusy(collection.publicId);
    setError('');
    try {
      if (collection.containsSeries) {
        await removeSeriesFromCollection(collection.publicId, seriesId);
      } else {
        await addSeriesToCollection(collection.publicId, seriesId);
      }
      setCollections((current) => current.map((item) => item.id === collection.id
        ? { ...item, containsSeries: !collection.containsSeries }
        : item));
    } catch (err) {
      setError(err.message || (en ? 'Could not update the collection.' : 'No se pudo actualizar la colección.'));
    } finally {
      setBusy('');
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!name.trim() || busy) return;
    setBusy('new');
    setError('');
    try {
      const response = await createCollection({ name: name.trim() });
      const created = response?.data?.collection;
      if (!created?.publicId) throw new Error(en ? 'Collection created, but it could not be opened.' : 'Se creó la colección, pero no se pudo abrir.');
      await addSeriesToCollection(created.publicId, seriesId);
      const updated = await getMyCollections(seriesId);
      setCollections((updated?.data?.collections || []).filter(item => item.type !== 'favorites'));
      setName('');
      setShowCreate(false);
    } catch (err) {
      setError(err.message || (en ? 'Could not create the collection.' : 'No se pudo crear la colección.'));
    } finally {
      setBusy('');
    }
  };

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="bottom"
      size="auto"
      padding={0}
      withCloseButton={false}
      styles={{ content: { height: 'auto', maxHeight: 'min(88dvh, 760px)', flex: 'none' } }}
      zIndex={10050}
      overlayProps={{ backgroundOpacity: 0.65, blur: 5 }}
      classNames={{ content: styles.saveDrawerContent, body: styles.saveDrawerBody }}
    >
      <div className={styles.saveDrawerLayout}>
        <div className={styles.saveDrawerHandle} aria-hidden="true" />
        <div className={styles.saveDrawerHeader}>
          <h2 className={styles.saveDrawerTitle}>{en ? 'Save to' : 'Guardar en'}</h2>
          <button className={styles.saveDrawerClose} type="button" onClick={onClose} aria-label={en ? 'Close' : 'Cerrar'}>
            <IconX size={20} stroke={1.8} />
          </button>
        </div>

        <label className={`${styles.saveCollectionRow} ${styles.saveFavoriteRow}`} data-selected={isFavorite}>
          <input
            type="checkbox"
            checked={isFavorite}
            disabled={Boolean(busy)}
            onChange={() => {
              setBusy('favorite');
              setError('');
              onSetFavorite(!isFavorite)
                .catch((err) => setError(err.message || (en ? 'Could not update Favorites.' : 'No se pudo actualizar Favoritos.')))
                .finally(() => setBusy(''));
            }}
          />
          <span className={`${styles.saveCollectionIcon} ${styles.saveFavoriteIcon}`}><IconHeart size={20} stroke={1.8} /></span>
          <span className={styles.saveCollectionText}>
            <strong>{en ? 'Favorites' : 'Favoritos'}</strong>
          </span>
          <span className={styles.saveCollectionCheck} aria-hidden="true">{isFavorite && <IconCheck size={14} stroke={2.5} />}</span>
        </label>

        <div className={styles.saveDrawerSectionLabel}>
          <span>{en ? 'Collections' : 'Colecciones'}</span>
          {!loading && <span className={styles.saveDrawerCount}>{collections.length}</span>}
          <Link className={styles.saveDrawerViewLink} href={getLocalizedPath('/mis-colecciones', lang)} onClick={onClose}>
            {en ? 'View collections' : 'Ver colecciones'}
          </Link>
        </div>
        {loading ? <p className={styles.saveDrawerMessage}>{en ? 'Loading collections…' : 'Cargando colecciones…'}</p> : (
          collections.length ? collections.map((collection) => (
            <label className={styles.saveCollectionRow} data-selected={Boolean(collection.containsSeries)} key={collection.id}>
              <input
                type="checkbox"
                checked={Boolean(collection.containsSeries)}
                disabled={Boolean(busy)}
                onChange={() => toggleCollection(collection)}
              />
              <span className={styles.saveCollectionIcon}><IconFolder size={20} stroke={1.8} /></span>
              <span className={styles.saveCollectionText}>
                <strong>{collection.name}</strong>
              </span>
              <span className={styles.saveCollectionCheck} aria-hidden="true">{collection.containsSeries && <IconCheck size={14} stroke={2.5} />}</span>
            </label>
          )) : <p className={styles.saveDrawerEmpty}>{en ? 'No collections yet.' : 'Aún no tienes colecciones.'}</p>
        )}

        {error && <p className={styles.saveDrawerError} role="alert">{error}</p>}

        {showCreate ? (
          <form className={styles.saveCreateForm} onSubmit={handleCreate}>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={200}
              placeholder={en ? 'Collection name' : 'Nombre de la colección'}
              aria-label={en ? 'Collection name' : 'Nombre de la colección'}
              required
            />
            <button type="submit" disabled={Boolean(busy)}>{en ? 'Create' : 'Crear'}</button>
            <button className={styles.saveCreateCancel} type="button" onClick={() => { setShowCreate(false); setName(''); }} aria-label={en ? 'Cancel' : 'Cancelar'}><IconX size={18} /></button>
          </form>
        ) : (
          <button className={styles.saveNewCollection} type="button" onClick={() => setShowCreate(true)}>
            <IconPlus size={19} stroke={1.8} /> {en ? 'New collection' : 'Nueva colección'}
          </button>
        )}
        <div className={styles.saveDrawerFooter}>
          <button type="button" onClick={onClose}>{en ? 'Done' : 'Listo'}</button>
        </div>
      </div>
    </Drawer>
  );
}
