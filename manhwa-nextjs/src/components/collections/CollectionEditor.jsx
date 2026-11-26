'use client';

import { useState } from 'react';
import { Modal } from '@mantine/core';
import { IconLink, IconLock, IconPhoto, IconTrash, IconWorld } from '@tabler/icons-react';
import ManhwaCover from '@/components/ManhwaCover';
import { deleteCollection, updateCollection } from '@/api/requests';
import { getCoverUrl } from '@/utils/imageUtils';
import styles from './CollectionEditor.module.css';

export default function CollectionEditor({ collection, lang = 'es', onClose, onSaved, onDeleted }) {
  const en = lang === 'en';
  const [name, setName] = useState(collection.name || '');
  const [description, setDescription] = useState(collection.description || '');
  const [coverUrl, setCoverUrl] = useState(collection.coverUrl || '');
  const [visibility, setVisibility] = useState(collection.visibility || 'private');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fallbackCover = getCoverUrl(collection.previewSeries?.[0]);
  const preview = coverUrl.trim() || fallbackCover;

  const save = async (event) => {
    event.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await updateCollection(collection.publicId, {
        name: name.trim(), description: description.trim(), coverUrl: coverUrl.trim(), visibility,
      });
      await onSaved?.(response?.data?.collection);
      onClose();
    } catch (err) {
      setError(err.message || (en ? 'Could not save changes.' : 'No se pudieron guardar los cambios.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy || !window.confirm(en ? `Delete “${collection.name}”? This cannot be undone.` : `¿Eliminar «${collection.name}»? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    setError('');
    try {
      await deleteCollection(collection.publicId);
      await onDeleted?.();
      onClose();
    } catch (err) {
      setError(err.message || (en ? 'Could not delete the collection.' : 'No se pudo eliminar la colección.'));
    } finally {
      setBusy(false);
    }
  };

  const choices = [
    { value: 'private', icon: IconLock, title: en ? 'Private' : 'Privada', hint: en ? 'Only you can see it' : 'Solo tú puedes verla' },
    { value: 'unlisted', icon: IconLink, title: en ? 'Unlisted' : 'No listada', hint: en ? 'Anyone with the link' : 'Quien tenga el enlace' },
    { value: 'public', icon: IconWorld, title: en ? 'Public' : 'Pública', hint: en ? 'Visible to everyone' : 'Visible para todos' },
  ];

  return <Modal
    opened
    onClose={() => { if (!busy) onClose(); }}
    centered
    size={720}
    title={<div className={styles.title}><span className={styles.eyebrow}>{en ? 'YOUR LIBRARY' : 'TU BIBLIOTECA'}</span><h2>{en ? 'Edit collection' : 'Editar colección'}</h2><p>{en ? 'Update how this collection looks and who can see it.' : 'Actualiza la presentación y visibilidad de tu colección.'}</p></div>}
    overlayProps={{ backgroundOpacity: 0.68, blur: 5 }}
    closeOnEscape={!busy}
    classNames={{ content: styles.modal, header: styles.header, body: styles.body, close: styles.close }}
  >
    <form onSubmit={save} className={styles.form}>
      <div className={styles.fields}>
        <div className={styles.field}>
          <label htmlFor="edit-collection-name">{en ? 'Name' : 'Nombre'} <span aria-hidden="true">*</span></label>
          <input id="edit-collection-name" autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={200} required />
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-collection-description">{en ? 'Description' : 'Descripción'} <small>{en ? 'Optional' : 'Opcional'}</small></label>
          <textarea id="edit-collection-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder={en ? 'What stories belong here?' : '¿Qué historias reúnes aquí?'} />
        </div>
        <div className={styles.field}>
          <label htmlFor="edit-collection-cover">{en ? 'Cover image URL' : 'URL de la portada'} <small>{en ? 'Optional' : 'Opcional'}</small></label>
          <input id="edit-collection-cover" type="url" value={coverUrl} onChange={event => setCoverUrl(event.target.value)} placeholder="https://..." />
          <p className={styles.hint}>{en ? 'Leave empty to use a cover from this collection.' : 'Déjala vacía para usar la portada de una obra de la colección.'}</p>
        </div>
      </div>
      <div className={styles.previewBlock}>
        <span className={styles.previewLabel}>{en ? 'COVER PREVIEW' : 'VISTA PREVIA'}</span>
        <div className={styles.preview}>
          {preview ? <ManhwaCover src={preview} fallbackSrc={fallbackCover} alt={en ? 'Collection cover preview' : 'Vista previa de la portada'} /> : <IconPhoto size={35} stroke={1.3} />}
        </div>
        <span className={styles.previewCaption}>{name.trim() || (en ? 'Your collection' : 'Tu colección')}</span>
      </div>
      <fieldset className={styles.visibility}>
        <legend>{en ? 'Visibility' : 'Visibilidad'}</legend>
        <div className={styles.visibilityOptions}>{choices.map(({ value, icon: Icon, title, hint }) => <label key={value} className={`${styles.visibilityOption} ${visibility === value ? styles.selected : ''}`}>
          <input type="radio" name="collection-visibility" value={value} checked={visibility === value} onChange={() => setVisibility(value)} />
          <Icon size={20} stroke={1.8} aria-hidden="true" />
          <strong>{title}</strong><small>{hint}</small>
        </label>)}</div>
      </fieldset>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        {collection.type !== 'favorites' && <button className={styles.deleteButton} type="button" disabled={busy} onClick={remove}><IconTrash size={17} stroke={1.8} />{en ? 'Delete' : 'Eliminar'}</button>}
        <div className={styles.actionGroup}>
          <button className={styles.cancelButton} type="button" disabled={busy} onClick={onClose}>{en ? 'Cancel' : 'Cancelar'}</button>
          <button className={styles.saveButton} type="submit" disabled={busy || !name.trim()}>{busy ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save changes' : 'Guardar cambios')}</button>
        </div>
      </div>
    </form>
  </Modal>;
}
