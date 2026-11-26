'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { IconArrowUpRight, IconBook2, IconFolder, IconHeartFilled, IconLink, IconLock, IconPencil, IconPlus, IconWorld } from '@tabler/icons-react';
import ManhwaCover from '@/components/ManhwaCover';
import CollectionEditor from '@/components/collections/CollectionEditor';
import { CollectionPageFrame, CollectionHero, CollectionSecondaryAction, CollectionSectionHeading } from '@/components/collections/CollectionPageChrome';
import { useAuth } from '@/contexts/AuthContext';
import { createCollection, getMyCollections } from '@/api/requests';
import { getCoverUrl } from '@/utils/imageUtils';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import styles from './MyCollections.module.css';

export default function MyCollectionsClient({ lang = 'es' }) {
  const { user, loading: authLoading, openLogin } = useAuth();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const en = lang === 'en';

  const loadCollections = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getMyCollections();
      setCollections(result?.data?.collections || []);
    } catch (err) {
      setError(err.message || (en ? 'Could not load collections.' : 'No se pudieron cargar las colecciones.'));
    } finally {
      setLoading(false);
    }
  }, [en]);

  useEffect(() => {
    if (!authLoading && user) loadCollections();
    if (!authLoading && !user) setLoading(false);
  }, [authLoading, user, loadCollections]);

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await createCollection({ name: name.trim(), description: description.trim(), coverUrl: coverUrl.trim() || null });
      setName('');
      setDescription('');
      setCoverUrl('');
      setShowForm(false);
      await loadCollections();
    } catch (err) {
      setError(err.message || (en ? 'Could not create the collection.' : 'No se pudo crear la colección.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <CollectionPageFrame lang={lang}>
        <CollectionHero
          eyebrow={en ? 'Your personal library' : 'Tu biblioteca personal'}
          title={en ? 'My collections' : 'Mis colecciones'}
          description={en ? 'Keep the stories you love together. Make a list for yourself or share it with other readers.' : 'Reúne las historias que te gustan. Crea listas para ti o compártelas con otros lectores.'}
          actions={user && <>
            <CollectionSecondaryAction href={getLocalizedPath('/colecciones', lang)}>
              {en ? 'Explore community' : 'Explorar comunidad'}
            </CollectionSecondaryAction>
            <button className={styles.primaryButton} type="button" onClick={() => setShowForm((value) => !value)} aria-expanded={showForm}>
              <IconPlus size={18} stroke={1.8} /> {en ? 'New collection' : 'Nueva colección'}
            </button>
          </>}
        />

        {authLoading ? (
          <p className={styles.message}>{en ? 'Loading account…' : 'Cargando cuenta…'}</p>
        ) : !user ? (
          <div className={styles.empty}>
            <IconFolder size={36} />
            <h2>{en ? 'Sign in to see your collections' : 'Inicia sesión para ver tus colecciones'}</h2>
            <button className={styles.primaryButton} type="button" onClick={openLogin}>{en ? 'Sign in' : 'Iniciar sesión'}</button>
          </div>
        ) : (
          <>
            {showForm && (
              <form className={styles.form} onSubmit={handleCreate}>
                <h2>{en ? 'Create collection' : 'Crear colección'}</h2>
                <label htmlFor="collection-name">{en ? 'Name' : 'Nombre'}</label>
                <input id="collection-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required />
                <label htmlFor="collection-description">{en ? 'Description (optional)' : 'Descripción (opcional)'}</label>
                <textarea id="collection-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} />
                <label htmlFor="collection-cover">{en ? 'Cover image URL (optional)' : 'URL de la imagen de portada (opcional)'}</label>
                <input id="collection-cover" type="url" value={coverUrl} onChange={(event) => setCoverUrl(event.target.value)} placeholder="https://..." />
                <span className={styles.fieldHint}>{en ? 'New collections are private.' : 'Las colecciones nuevas son privadas.'}</span>
                <button className={styles.primaryButton} type="submit" disabled={saving}>
                  {saving ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Create' : 'Crear')}
                </button>
              </form>
            )}

            {error && <div className={styles.error} role="alert">{error}</div>}
            {!loading && <CollectionSectionHeading
              index={en ? 'Your shelves' : 'Tus estantes'}
              title={en ? 'Your library' : 'Tu biblioteca'}
              count={`${collections.length} ${en ? (collections.length === 1 ? 'collection' : 'collections') : (collections.length === 1 ? 'colección' : 'colecciones')}`}
            />}
            {loading ? <p className={styles.message}>{en ? 'Loading collections…' : 'Cargando colecciones…'}</p> : collections.length === 0 ? (
              <div className={styles.empty}>
                <IconFolder size={36} stroke={1.3} />
                <h2>{en ? 'Your library starts here.' : 'Tu biblioteca empieza aquí.'}</h2>
                <p>{en ? 'Create your first collection and gather the stories you want to keep close.' : 'Crea tu primera colección y reúne las historias que quieras conservar.'}</p>
                <button className={styles.primaryButton} type="button" onClick={() => setShowForm(true)}><IconPlus size={17} />{en ? 'New collection' : 'Nueva colección'}</button>
              </div>
            ) : (
              <div className={styles.grid}>
                {collections.map((collection) => {
                  const isDefault = collection.type === 'favorites';
                  const preview = collection.previewSeries?.[0];
                  const image = collection.coverUrl || getCoverUrl(preview);
                  return (
                    <article className={`${styles.card} ${isDefault ? styles.favoriteCard : ''}`} key={collection.id}>
                      <Link className={styles.cardButton} href={`${getLocalizedPath('/mis-colecciones', lang)}/${collection.publicId}`}>
                        <span className={`${styles.cardBanner} ${image ? styles.hasImage : ''}`}>
                          {image ? <ManhwaCover src={image} fallbackSrc={getCoverUrl(preview)} alt={en ? `${collection.name} cover` : `Portada de ${collection.name}`} className={styles.bannerImage} /> : null}
                          <span className={styles.bannerShade} />
                          <span className={styles.bannerIcon}>{isDefault ? <IconHeartFilled size={24} /> : <IconFolder size={24} />}</span>
                          <span className={styles.bannerLabel}>{isDefault ? (en ? 'YOUR FAVORITES' : 'TUS FAVORITOS') : (en ? 'YOUR COLLECTION' : 'TU COLECCIÓN')}</span>
                          <span className={styles.bannerCount}><strong>{collection.manhwasCount ?? 0}</strong><small>{en ? 'titles' : 'obras'}</small></span>
                        </span>
                        <span className={styles.cardContent}>
                          <span className={styles.cardTitleRow}><strong>{collection.name}</strong><IconArrowUpRight size={18} /></span>
                          <span className={styles.cardDescription}>{collection.description || (en ? 'A space for your favorite stories.' : 'Un espacio para tus historias favoritas.')}</span>
                          <span className={styles.meta}>
                            {collection.visibility === 'public' ? <IconWorld size={15} /> : collection.visibility === 'unlisted' ? <IconLink size={15} /> : <IconLock size={15} />}
                            {collection.visibility === 'public' ? (en ? 'Public' : 'Pública') : collection.visibility === 'unlisted' ? (en ? 'Unlisted' : 'No listada') : (en ? 'Private' : 'Privada')}
                            <span className={styles.metaDot}>·</span><IconBook2 size={15} /> {collection.manhwasCount ?? '—'} {en ? 'titles' : 'obras'}
                          </span>
                        </span>
                      </Link>
                      <div className={styles.cardActions}>
                        <button className={styles.editButton} type="button" onClick={() => setEditing(collection)} aria-label={en ? `Edit ${collection.name}` : `Editar ${collection.name}`}>
                          <IconPencil size={16} stroke={1.8} /> {en ? 'Edit' : 'Editar'}
                        </button>
                        <Link className={styles.shareLink} href={isDefault
                          ? getLocalizedPath(`/u/${user.username}/favoritos`, lang)
                          : getLocalizedPath(`/coleccion/${collection.publicId}-${collection.slug}`, lang)}>
                          {collection.visibility === 'private' ? (en ? 'View page' : 'Ver página') : (en ? 'Open link' : 'Abrir enlace')}
                          <IconArrowUpRight size={16} stroke={1.8} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      {editing && <CollectionEditor key={editing.publicId} collection={editing} lang={lang} onClose={() => setEditing(null)} onSaved={loadCollections} onDeleted={loadCollections} />}
    </CollectionPageFrame>
  );
}
