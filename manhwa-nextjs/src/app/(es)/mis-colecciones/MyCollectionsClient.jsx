'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal } from '@mantine/core';
import { IconArrowUpRight, IconFolder, IconHeartFilled, IconLock, IconPencil, IconPlus, IconWorld } from '@tabler/icons-react';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import { useAuth } from '@/contexts/AuthContext';
import { createCollection, getMyCollections, updateCollection, deleteCollection } from '@/api/requests';
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
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const en = lang === 'en';
  const displayCollections = collections;

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

  const openEditor = (collection) => {
    setEditing(collection);
    setEditName(collection.name);
    setEditDescription(collection.description || '');
    setEditCoverUrl(collection.coverUrl || '');
    setEditVisibility(collection.visibility);
    setEditError('');
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editing || !editName.trim() || savingEdit) return;
    setSavingEdit(true);
    setEditError('');
    try {
      await updateCollection(editing.publicId, {
        name: editName.trim(),
        description: editDescription.trim(),
        coverUrl: editCoverUrl.trim(),
        visibility: editVisibility,
      });
      setEditing(null);
      await loadCollections();
    } catch (err) {
      setEditError(err.message || (en ? 'Could not save changes.' : 'No se pudieron guardar los cambios.'));
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <main className={styles.page}>
      <Header lang={lang} />
      <div className={styles.container}>
        <div className={styles.heading}>
          <div>
            <Link className={styles.backLink} href={getLocalizedPath('/home', lang)}>
              {en ? 'Home' : 'Inicio'}
            </Link>
            <h1>{en ? 'My collections' : 'Mis colecciones'}</h1>
            <p>{en ? 'Keep the stories you love together in your own lists.' : 'Organiza tus obras favoritas en listas propias.'}</p>
          </div>
          {user && (
            <button className={styles.primaryButton} type="button" onClick={() => setShowForm((value) => !value)}>
              <IconPlus size={18} /> {en ? 'New collection' : 'Nueva colección'}
            </button>
          )}
        </div>

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
            {loading ? <p className={styles.message}>{en ? 'Loading collections…' : 'Cargando colecciones…'}</p> : (
              <div className={styles.grid}>
                {displayCollections.map((collection) => {
                  const isDefault = collection.type === 'favorites';
                  const preview = collection.previewSeries?.[0];
                  const image = collection.coverUrl || getCoverUrl(preview);
                  return (
                    <article className={`${styles.card} ${isDefault ? styles.favoriteCard : ''}`} key={collection.id}>
                      <Link className={styles.cardButton} href={`${getLocalizedPath('/mis-colecciones', lang)}/${collection.publicId}`}>
                        <span className={styles.cardBanner}>
                          {image ? <ManhwaCover src={image} fallbackSrc={getCoverUrl(preview)} alt={en ? `${collection.name} cover` : `Portada de ${collection.name}`} className={styles.bannerImage} /> : null}
                          <span className={styles.bannerShade} />
                          <span className={styles.bannerIcon}>{isDefault ? <IconHeartFilled size={24} /> : <IconFolder size={24} />}</span>
                          <span className={styles.bannerLabel}>{isDefault ? (en ? 'YOUR FAVORITES' : 'TUS FAVORITOS') : (en ? 'YOUR COLLECTION' : 'TU COLECCIÓN')}</span>
                        </span>
                        <span className={styles.cardContent}>
                          <span className={styles.cardTitleRow}><strong>{collection.name}</strong><IconArrowUpRight size={18} /></span>
                          <span className={styles.cardDescription}>{collection.description || (en ? 'A space for your favorite stories.' : 'Un espacio para tus historias favoritas.')}</span>
                          <span className={styles.meta}>
                            {isDefault ? <IconHeartFilled size={14} /> : collection.visibility === 'public' ? <IconWorld size={14} /> : <IconLock size={14} />}
                            {collection.visibility === 'public' ? (en ? 'Public' : 'Pública') : collection.visibility === 'unlisted' ? (en ? 'Unlisted' : 'No listada') : (en ? 'Private' : 'Privada')}
                            <span className={styles.metaDot}>·</span> {collection.manhwasCount ?? '—'} {en ? 'titles' : 'obras'}
                          </span>
                        </span>
                      </Link>
                      <button className={styles.editButton} type="button" onClick={() => openEditor(collection)} aria-label={en ? `Edit ${collection.name}` : `Editar ${collection.name}`}>
                        <IconPencil size={16} /> {en ? 'Edit' : 'Editar'}
                      </button>
                      <Link className={styles.editButton} href={isDefault
                        ? getLocalizedPath(`/u/${user.username}/favoritos`, lang)
                        : getLocalizedPath(`/coleccion/${collection.publicId}-${collection.slug}`, lang)}>
                        {en ? 'Open share link' : 'Abrir enlace para compartir'}
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        opened={Boolean(editing)}
        onClose={() => { if (!savingEdit) setEditing(null); }}
        title={en ? 'Edit collection' : 'Editar colección'}
        centered
        size="lg"
        overlayProps={{ backgroundOpacity: 0.7, blur: 6 }}
        classNames={{ content: styles.editModal, header: styles.editModalHeader, body: styles.editModalBody }}
      >
        <form className={styles.editForm} onSubmit={handleEdit}>
          <label htmlFor="edit-collection-name">{en ? 'Name' : 'Nombre'}</label>
          <input id="edit-collection-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={200} required />
          <label htmlFor="edit-collection-description">{en ? 'Description' : 'Descripción'}</label>
          <textarea id="edit-collection-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={2000} rows={3} />
          <label htmlFor="edit-collection-cover">{en ? 'Cover image URL' : 'URL de la imagen de portada'}</label>
          <input id="edit-collection-cover" type="url" value={editCoverUrl} onChange={(event) => setEditCoverUrl(event.target.value)} placeholder="https://..." />
          {(editCoverUrl || editing?.previewSeries?.[0]) && (
            <div className={styles.editPreview}>
              <ManhwaCover src={editCoverUrl || getCoverUrl(editing?.previewSeries?.[0])} fallbackSrc={getCoverUrl(editing?.previewSeries?.[0])} alt={en ? 'Collection cover preview' : 'Vista previa de la portada'} />
            </div>
          )}
          <span className={styles.fieldHint}>{en ? 'Leave empty to use the cover of a story in this collection.' : 'Déjalo vacío para usar la portada de una obra de esta colección.'}</span>
          <label htmlFor="edit-collection-visibility">{en ? 'Visibility' : 'Visibilidad'}</label>
          <select id="edit-collection-visibility" value={editVisibility} onChange={(event) => setEditVisibility(event.target.value)}>
            <option value="private">{en ? 'Private' : 'Privada'}</option>
            <option value="unlisted">{en ? 'Unlisted (link only)' : 'No listada (solo enlace)'}</option>
            <option value="public">{en ? 'Public' : 'Pública'}</option>
          </select>
          {editError && <p className={styles.error} role="alert">{editError}</p>}
          <div className={styles.editActions}>
            {editing?.type !== 'favorites' && <button className={styles.cancelButton} type="button" disabled={savingEdit} onClick={async () => {
              if (!window.confirm(en ? 'Delete this collection?' : '¿Eliminar esta colección?')) return;
              try { await deleteCollection(editing.publicId); setEditing(null); await loadCollections(); }
              catch (err) { setEditError(err.message); }
            }}>{en ? 'Delete' : 'Eliminar'}</button>}
            <button className={styles.cancelButton} type="button" onClick={() => setEditing(null)} disabled={savingEdit}>{en ? 'Cancel' : 'Cancelar'}</button>
            <button className={styles.primaryButton} type="submit" disabled={savingEdit}>{savingEdit ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save changes' : 'Guardar cambios')}</button>
          </div>
        </form>
      </Modal>
    </main>
  );
}
