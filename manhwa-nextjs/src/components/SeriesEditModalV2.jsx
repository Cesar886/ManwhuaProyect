import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IconX, IconUpload, IconDeviceFloppy, IconLoader2, IconCheck, IconAlertCircle,
  IconPhoto, IconRotate, IconTrash, IconChevronDown, IconChevronUp,
  IconFileText, IconTag, IconPhotoPlus
} from '@tabler/icons-react';
import { listGenres, uploadSeriesCover } from '../api/requests';
import useSeriesForm from '../hooks/useSeriesForm';
import { useToast } from '../hooks/useToast';
import styles from './SeriesEditModalV2.module.css';

/**
 * Modal mejorado para editar información de una serie (solo admins)
 * 
 * Características:
 * - Lógica separada para subida de imagen y metadata
 * - Estados de carga independientes
 * - Validación en tiempo real
 * - Drag & drop para imágenes
 * - Confirmación de salida con cambios sin guardar
 * - Indicadores visuales de campos modificados
 * - Toast notifications
 * - Secciones colapsables
 */

// Componente de progreso de subida
function UploadProgress({ progress, isUploading }) {
  console.log('UploadProgress props:', { progress, isUploading });
  if (!isUploading) return null;

  return (
    <div className={styles.uploadProgress}>
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>
      <span className={styles.progressText}>{progress}%</span>
    </div>
  );
}

// Componente de sección colapsable
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true, badge = null }) {
  console.log('CollapsibleSection props:', { title, Icon, defaultOpen, badge });
  const [isOpen, setIsOpen] = useState(defaultOpen);

  console.log('CollapsibleSection isOpen:', isOpen);
  return (
    <div className={`${styles.section} ${isOpen ? styles.sectionOpen : ''}`}>
      <button
        type="button"
        className={styles.sectionHeader}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className={styles.sectionTitle}>
          {Icon && <Icon size={18} />}
          <span>{title}</span>
          {badge && <span className={styles.sectionBadge}>{badge}</span>}
        </div>
        {isOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
      </button>
      {isOpen && (
        <div className={styles.sectionContent}>
          {children}
        </div>
      )}
    </div>
  );
}

// Componente de campo con contador de caracteres
function TextFieldWithCounter({
  id, name, label, value, onChange, onBlur,
  maxLength, error, touched, modified,
  multiline = false, rows = 4, placeholder = '', required = false
}) {
  console.log('TextFieldWithCounter props:', { id, name, label, value, maxLength, error, touched, modified, multiline, rows, placeholder, required });
  const charCount = value?.length || 0;
  const isNearLimit = maxLength && charCount > maxLength * 0.9;
  const isOverLimit = maxLength && charCount > maxLength;

  const InputComponent = multiline ? 'textarea' : 'input';

  console.log('TextFieldWithCounter charCount:', charCount);
  return (
    <div className={`${styles.formGroup} ${modified ? styles.fieldModified : ''}`}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      <div className={styles.inputWrapper}>
        <InputComponent
          id={id}
          name={name}
          type={multiline ? undefined : "text"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          className={`${multiline ? styles.textarea : styles.input} ${error && touched ? styles.inputError : ''} ${modified ? styles.inputModified : ''}`}
          placeholder={placeholder}
          rows={multiline ? rows : undefined}
          aria-invalid={error && touched ? 'true' : 'false'}
          aria-describedby={error && touched ? `${id}-error` : undefined}
        />
        {maxLength && (
          <span className={`${styles.charCounter} ${isNearLimit ? styles.charWarning : ''} ${isOverLimit ? styles.charError : ''}`}>
            {charCount}/{maxLength}
          </span>
        )}
      </div>
      {error && touched && (
        <span id={`${id}-error`} className={styles.fieldError} role="alert">
          <IconAlertCircle size={14} />
          {error}
        </span>
      )}
    </div>
  );
}

// Componente de zona de drop para imágenes
function ImageDropZone({
  coverPreview,
  coverFile,
  onFileChange,
  onRemove,
  isUploading,
  uploadProgress,
  error
}) {
  console.log('ImageDropZone props:', { coverPreview, coverFile, isUploading, uploadProgress, error });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    console.log('ImageDropZone handleDragOver');
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    console.log('ImageDropZone handleDragLeave');
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    console.log('ImageDropZone handleDrop');
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      await onFileChange(file);
    }
  };

  const handleClick = () => {
    console.log('ImageDropZone handleClick');
    fileInputRef.current?.click();
  };

  const handleInputChange = async (e) => {
    console.log('ImageDropZone handleInputChange');
    const file = e.target.files?.[0];
    if (file) {
      await onFileChange(file);
    }
  };

  const handlePaste = async (e) => {
    console.log('ImageDropZone handlePaste');
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          await onFileChange(file);
          break;
        }
      }
    }
  };

  return (
    <div
      className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''} ${coverFile ? styles.dropZoneHasFile : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
      role="button"
      aria-label="Zona de arrastre para imagen de portada"
    >
      {coverPreview ? (
        <div className={styles.previewContainer}>
          <img
            src={coverPreview}
            alt="Vista previa de portada"
            className={styles.coverPreview}
          />
          {coverFile && (
            <div className={styles.newBadge}>
              <IconPhotoPlus size={14} />
              Nueva
            </div>
          )}
          <div className={styles.previewActions}>
            <button
              type="button"
              onClick={handleClick}
              className={styles.previewButton}
              title="Cambiar imagen"
            >
              <IconUpload size={16} />
            </button>
            {coverFile && (
              <button
                type="button"
                onClick={onRemove}
                className={`${styles.previewButton} ${styles.previewButtonDanger}`}
                title="Descartar nueva imagen"
              >
                <IconTrash size={16} />
              </button>
            )}
          </div>
          <UploadProgress progress={uploadProgress} isUploading={isUploading} />
        </div>
      ) : (
        <div className={styles.dropZonePlaceholder} onClick={handleClick}>
          <IconPhoto size={48} strokeWidth={1} />
          <p>Arrastra una imagen aquí</p>
          <span>o haz clic para seleccionar</span>
          <span className={styles.dropZoneFormats}>JPG, PNG, WebP, GIF · Máx 5MB</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleInputChange}
        className={styles.fileInput}
        aria-hidden="true"
      />

      {error && (
        <div className={styles.dropZoneError}>
          <IconAlertCircle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}

// Componente principal del modal
export default function SeriesEditModal({ series, isOpen, onClose, onSave }) {
  // Estado de géneros
  const [availableGenres, setAvailableGenres] = useState([]);
  const [genresLoading, setGenresLoading] = useState(false);

  // Estado de subida de imagen
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageError, setImageError] = useState('');

  // Modal de confirmación de salida
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Toast notifications
  const toastContext = useToast();
  const toast = React.useMemo(() => toastContext || {
    success: (msg) => console.log('✅', msg),
    error: (msg) => console.error('❌', msg),
    warning: (msg) => console.warn('⚠️', msg),
    info: (msg) => console.info('ℹ️', msg)
  }, [toastContext]);

  // Hook del formulario
  const form = useSeriesForm(series, isOpen, availableGenres);

  // Cargar géneros
  const fetchGenres = useCallback(async () => {
    if (availableGenres.length > 0) return;

    setGenresLoading(true);
    try {
      const response = await listGenres();
      if (response.success && response.data?.genres) {
        setAvailableGenres(response.data.genres);
      }
    } catch (err) {
      console.error('Error al cargar géneros:', err);
      toast.error('Error al cargar géneros');
    } finally {
      setGenresLoading(false);
    }
  }, [availableGenres.length, toast]);

  useEffect(() => {
    if (isOpen) {
      fetchGenres();
    }
  }, [isOpen, fetchGenres]);

  // Manejar cambio de archivo
  const handleImageFileChange = async (file) => {
    console.log('handleImageFileChange file:', file);
    setImageError('');
    const result = await form.handleFileChange(file);
    console.log('handleImageFileChange result:', result);
    if (!result.success) {
      setImageError(result.error);
      toast.error(result.error);
    }
  };

  // Referencia para el submit handler
  const submitRef = React.useRef(null);
  const closeRef = React.useRef(null);

  // Manejar tecla Escape y atajos
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      console.log('keydown event:', e.key, e.ctrlKey, e.metaKey);
      // Escape para cerrar
      if (e.key === 'Escape') {
        closeRef.current?.();
      }

      // Ctrl+S para guardar
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitRef.current?.(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Manejar cierre con confirmación
  const handleClose = useCallback(() => {
    console.log('handleClose called, isDirty:', form.isDirty());
    if (form.isDirty()) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [form, onClose]);

  // Confirmar salida
  const confirmExit = useCallback(() => {
    console.log('confirmExit called');
    form.clearDraft();
    setShowExitConfirm(false);
    onClose();
  }, [form, onClose]);

  // Cancelar salida
  const cancelExit = useCallback(() => {
    console.log('cancelExit called');
    setShowExitConfirm(false);
  }, []);

  // Calcular qué campos han sido modificados
  const isFieldModified = useCallback((fieldName) => {
    if (!form.originalData) return false;
    const current = form.formData[fieldName];
    const original = form.originalData[fieldName];
    const normCurrent = current === '' || current === null || current === undefined ? '' : current;
    const normOriginal = original === '' || original === null || original === undefined ? '' : original;
    const modified = normCurrent !== normOriginal;
    console.log('isFieldModified', fieldName, { current, original, modified });
    return modified;
  }, [form.formData, form.originalData]);

  // 🔥 FUNCIÓN CLAVE: Preparar datos completos para enviar al backend
  const prepareCompleteData = useCallback(() => {
    console.log('🔥 prepareCompleteData - Preparando datos completos');
    console.log('formData actual:', form.formData);
    console.log('selectedGenres:', form.selectedGenres);

    // Combinar TODOS los datos del formulario, no solo los modificados
    const completeData = {
      // Campos básicos - SIEMPRE incluir todos
      title: form.formData.title || '',
      originalTitle: form.formData.originalTitle || '',
      author: form.formData.author || '',
      synopsis: form.formData.synopsis || '',
      status: form.formData.status || 'ongoing',
      contentType: form.formData.contentType || 'manhwa',
      releaseYear: form.formData.releaseYear || null,
      isAdult: Boolean(form.formData.isAdult),
      isFeatured: Boolean(form.formData.isFeatured),
      isHot: Boolean(form.formData.isHot),

      // Géneros - SIEMPRE incluir el array completo
      genres: form.selectedGenres || [],

      // Campos que vienen de series original - preservar
      slug: series.slug,
    };

    console.log('✅ Datos completos preparados:', completeData);
    return completeData;
  }, [form.formData, form.selectedGenres, series.slug]);

  // Manejar envío del formulario
  const handleSubmit = async (e) => {
    console.log('handleSubmit called', e);
    e?.preventDefault();

    // Validar formulario
    if (!form.validate()) {
      toast.error('Por favor corrige los errores antes de guardar');
      return;
    }

    const changeTypes = form.getChangeTypes();
    const hasMetadataChanges = changeTypes.metadata || changeTypes.genres;
    const hasImageChange = changeTypes.image;

    console.log('handleSubmit changeTypes:', changeTypes);

    if (!hasMetadataChanges && !hasImageChange) {
      toast.warning('No hay cambios para guardar');
      return;
    }

    let metadataSuccess = true;
    let imageSuccess = true;
    let metadataResult = null;
    let imageResult = null;

    try {
      // 1. Guardar metadata si hay cambios
      if (hasMetadataChanges) {
        form.setLoading('metadata', true);
        try {
          // 🔥 CAMBIO CLAVE: Enviar TODOS los datos, no solo los modificados
          const completeData = prepareCompleteData();
          console.log('🔥 Enviando datos completos al backend:', completeData);

          metadataResult = await onSave(completeData);
          console.log('handleSubmit metadataResult:', metadataResult);
          toast.success('Información actualizada correctamente');
        } catch (err) {
          metadataSuccess = false;
          const errorMessage = getErrorMessage(err);
          form.setSubmitError(errorMessage);
          toast.error(`Error al guardar: ${errorMessage}`);
          console.error('handleSubmit metadata error:', err);
        } finally {
          form.setLoading('metadata', false);
        }
      }

      // 2. Subir imagen si hay cambio (INDEPENDIENTE de metadata)
      if (hasImageChange && form.coverFile) {
        form.setLoading('image', true);
        setUploadProgress(0);

        try {
          // Simular progreso (el backend no soporta progress real por ahora)
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 90));
          }, 100);

          imageResult = await uploadSeriesCover(series.slug, form.coverFile);
          console.log('handleSubmit imageResult:', imageResult);

          clearInterval(progressInterval);
          setUploadProgress(100);
          toast.success('Portada actualizada correctamente');
        } catch (err) {
          imageSuccess = false;
          const errorMessage = getErrorMessage(err);
          setImageError(errorMessage);
          toast.error(`Error al subir imagen: ${errorMessage}`);
          console.error('handleSubmit image error:', err);
        } finally {
          form.setLoading('image', false);
          setTimeout(() => setUploadProgress(0), 1000);
        }
      }

      // Si todo fue exitoso, cerrar modal
      if (metadataSuccess && imageSuccess) {
        form.clearDraft();
        onClose();

        // Disparar evento personalizado para recargar datos
        if (hasMetadataChanges || hasImageChange) {
          const completeData = prepareCompleteData();
          const newCoverUrl = imageResult?.data?.coverUrl || imageResult?.coverUrl;

          window.dispatchEvent(new CustomEvent('seriesUpdated', {
            detail: {
              slug: series.slug,
              updateType: hasImageChange ? 'all' : 'metadata',
              // Usar la coverUrl nueva si se subió imagen, sino la existente
              coverUrl: newCoverUrl || form.coverPreview || series.cover || series.coverUrl || series.cover_url,
              // Incluir TODOS los campos actualizados
              updatedFields: completeData,
              // Incluir respuesta del servidor
              serverData: metadataResult?.data || imageResult?.data
            }
          }));
        }
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      form.setSubmitError(errorMessage);
      toast.error(`Error inesperado: ${errorMessage}`);
      console.error('handleSubmit unexpected error:', err);
    }
  };

  // Guardar solo imagen
  const handleSaveImageOnly = async () => {
    console.log('handleSaveImageOnly called');
    if (!form.coverFile) {
      toast.warning('No hay imagen nueva para guardar');
      return;
    }

    form.setLoading('image', true);
    setUploadProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);

      const result = await uploadSeriesCover(series.slug, form.coverFile);
      console.log('handleSaveImageOnly result:', result);

      clearInterval(progressInterval);
      setUploadProgress(100);
      toast.success('Portada actualizada correctamente');

      // Limpiar estado de imagen
      form.removeSelectedImage();
      setImageError('');
      form.clearDraft();

      // Cerrar modal y disparar evento de actualización
      setTimeout(() => {
        setUploadProgress(0);
        onClose();

        // Disparar evento personalizado para que el componente padre recargue
        window.dispatchEvent(new CustomEvent('seriesUpdated', {
          detail: {
            slug: series.slug,
            coverUrl: result.data?.coverUrl || result.coverUrl,
            updateType: 'cover'
          }
        }));
      }, 300);
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      setImageError(errorMessage);
      toast.error(`Error al subir imagen: ${errorMessage}`);
      console.error('handleSaveImageOnly error:', err);
    } finally {
      form.setLoading('image', false);
    }
  };

  // Guardar solo metadata
  const handleSaveMetadataOnly = async () => {
    console.log('handleSaveMetadataOnly called');

    const changeTypes = form.getChangeTypes();
    console.log('handleSaveMetadataOnly changeTypes:', changeTypes);

    if (!changeTypes.metadata && !changeTypes.genres) {
      toast.warning('No hay cambios en la información para guardar');
      return;
    }

    if (!form.validate()) {
      toast.error('Por favor corrige los errores antes de guardar');
      return;
    }

    form.setLoading('metadata', true);

    try {
      // 🔥 CAMBIO CLAVE: Enviar TODOS los datos, no solo los modificados
      const completeData = prepareCompleteData();
      console.log('🔥 handleSaveMetadataOnly - Enviando datos completos:', completeData);

      const result = await onSave(completeData);
      console.log('handleSaveMetadataOnly result:', result);

      toast.success('Información actualizada correctamente');
      form.clearDraft();
      onClose();

      // Disparar evento para recargar datos - incluir los campos actualizados
      window.dispatchEvent(new CustomEvent('seriesUpdated', {
        detail: {
          slug: series.slug,
          updateType: 'metadata',
          // Incluir la coverUrl actual para que no se pierda
          coverUrl: form.coverPreview || series.cover || series.coverUrl || series.cover_url,
          // Incluir TODOS los campos actualizados
          updatedFields: completeData,
          // Incluir respuesta del servidor si existe
          serverData: result?.data
        }
      }));
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      form.setSubmitError(errorMessage);
      toast.error(`Error al guardar: ${errorMessage}`);
      console.error('handleSaveMetadataOnly error:', err);
    } finally {
      form.setLoading('metadata', false);
    }
  };

  // Actualizar refs para los atajos de teclado
  useEffect(() => {
    submitRef.current = handleSubmit;
    closeRef.current = handleClose;
  });

  if (!isOpen) {
    return null;
  }

  const changeTypes = form.getChangeTypes();

  return (
    <>
      <div className={styles.overlay} onClick={handleClose}>
        <div
          className={styles.modal}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <h2 id="modal-title">Editar Serie</h2>
              {form.isDirty() && (
                <span className={styles.unsavedBadge} title="Cambios sin guardar">
                  <IconAlertCircle size={14} />
                  Sin guardar
                </span>
              )}
            </div>
            <div className={styles.headerActions}>
              <button
                type="button"
                onClick={form.resetForm}
                className={styles.iconButton}
                title="Deshacer todos los cambios"
                disabled={!form.isDirty() || form.isLoading}
              >
                <IconRotate size={18} />
              </button>
              <button
                onClick={handleClose}
                className={styles.closeButton}
                aria-label="Cerrar modal"
              >
                <IconX size={24} />
              </button>
            </div>
          </div>

          {/* Mensaje de error global */}
          {form.submitError && (
            <div className={styles.error} role="alert">
              <IconAlertCircle size={18} />
              {form.submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Sección de Portada */}
            <CollapsibleSection
              title="Imagen de Portada"
              icon={IconPhoto}
              badge={changeTypes.image ? '●' : null}
            >
              <div className={styles.coverSection}>
                <ImageDropZone
                  coverPreview={form.coverPreview}
                  coverFile={form.coverFile}
                  onFileChange={handleImageFileChange}
                  onRemove={form.removeSelectedImage}
                  isUploading={form.loadingStates.image}
                  uploadProgress={uploadProgress}
                  error={imageError}
                />

                {/* Botón para guardar solo imagen */}
                {form.coverFile && (
                  <button
                    type="button"
                    onClick={handleSaveImageOnly}
                    className={styles.saveImageButton}
                    disabled={form.loadingStates.image}
                  >
                    {form.loadingStates.image ? (
                      <>
                        <IconLoader2 size={16} className={styles.spinner} />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <IconUpload size={16} />
                        Guardar solo portada
                      </>
                    )}
                  </button>
                )}
              </div>
            </CollapsibleSection>

            {/* Sección de Información Básica */}
            <CollapsibleSection
              title="Información Básica"
              icon={IconFileText}
              badge={changeTypes.metadata ? '●' : null}
            >
              <div className={styles.formGrid}>
                <TextFieldWithCounter
                  id="title"
                  name="title"
                  label="Título"
                  value={form.formData.title}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  maxLength={500}
                  error={form.validationErrors.title}
                  touched={form.touchedFields.title}
                  modified={isFieldModified('title')}
                  placeholder="Título de la serie"
                  required
                />

                <TextFieldWithCounter
                  id="originalTitle"
                  name="originalTitle"
                  label="Título Original"
                  value={form.formData.originalTitle}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  maxLength={500}
                  error={form.validationErrors.originalTitle}
                  touched={form.touchedFields.originalTitle}
                  modified={isFieldModified('originalTitle')}
                  placeholder="Título en idioma original"
                />

                <TextFieldWithCounter
                  id="author"
                  name="author"
                  label="Autor"
                  value={form.formData.author}
                  onChange={form.handleChange}
                  onBlur={form.handleBlur}
                  maxLength={200}
                  error={form.validationErrors.author}
                  touched={form.touchedFields.author}
                  modified={isFieldModified('author')}
                  placeholder="Nombre del autor"
                />

                {/* Estado */}
                <div className={`${styles.formGroup} ${isFieldModified('status') ? styles.fieldModified : ''}`}>
                  <label htmlFor="status" className={styles.label}>Estado</label>
                  <select
                    id="status"
                    name="status"
                    value={form.formData.status}
                    onChange={form.handleChange}
                    className={`${styles.select} ${isFieldModified('status') ? styles.inputModified : ''}`}
                  >
                    <option value="ongoing">En emisión</option>
                    <option value="completed">Completado</option>
                    <option value="hiatus">En pausa</option>
                    <option value="dropped">Cancelado</option>
                    <option value="upcoming">Próximamente</option>
                  </select>
                </div>

                {/* Tipo */}
                <div className={`${styles.formGroup} ${isFieldModified('contentType') ? styles.fieldModified : ''}`}>
                  <label htmlFor="contentType" className={styles.label}>Tipo</label>
                  <select
                    id="contentType"
                    name="contentType"
                    value={form.formData.contentType}
                    onChange={form.handleChange}
                    className={`${styles.select} ${isFieldModified('contentType') ? styles.inputModified : ''}`}
                  >
                    <option value="manhwa">Manhwa</option>
                    <option value="manga">Manga</option>
                    <option value="manhua">Manhua</option>
                    <option value="webtoon">Webtoon</option>
                  </select>
                </div>

                {/* Año */}
                <div className={`${styles.formGroup} ${isFieldModified('releaseYear') ? styles.fieldModified : ''}`}>
                  <label htmlFor="releaseYear" className={styles.label}>Año de Lanzamiento</label>
                  <input
                    id="releaseYear"
                    name="releaseYear"
                    type="number"
                    min="1900"
                    max={new Date().getFullYear() + 5}
                    value={form.formData.releaseYear}
                    onChange={form.handleChange}
                    onBlur={form.handleBlur}
                    className={`${styles.input} ${isFieldModified('releaseYear') ? styles.inputModified : ''}`}
                    placeholder="2023"
                  />
                  {form.validationErrors.releaseYear && form.touchedFields.releaseYear && (
                    <span className={styles.fieldError}>
                      <IconAlertCircle size={14} />
                      {form.validationErrors.releaseYear}
                    </span>
                  )}
                </div>
              </div>

              {/* Checkboxes */}
              <div className={styles.checkboxGrid}>
                <label className={`${styles.checkbox} ${isFieldModified('isAdult') ? styles.checkboxModified : ''}`}>
                  <input
                    type="checkbox"
                    name="isAdult"
                    checked={form.formData.isAdult}
                    onChange={form.handleChange}
                  />
                  <span className={styles.checkboxLabel}>Contenido Adulto (+18)</span>
                </label>
                <label className={`${styles.checkbox} ${isFieldModified('isFeatured') ? styles.checkboxModified : ''}`}>
                  <input
                    type="checkbox"
                    name="isFeatured"
                    checked={form.formData.isFeatured}
                    onChange={form.handleChange}
                  />
                  <span className={styles.checkboxLabel}>Destacado</span>
                </label>
                <label className={`${styles.checkbox} ${isFieldModified('isHot') ? styles.checkboxModified : ''}`}>
                  <input
                    type="checkbox"
                    name="isHot"
                    checked={form.formData.isHot}
                    onChange={form.handleChange}
                  />
                  <span className={styles.checkboxLabel}>Hot / Trending</span>
                </label>
              </div>
            </CollapsibleSection>

            {/* Sección de Géneros */}
            <CollapsibleSection
              title="Géneros"
              icon={IconTag}
              badge={changeTypes.genres ? '●' : null}
            >
              <div className={styles.genreSection}>
                {genresLoading ? (
                  <div className={styles.genreLoading}>
                    <IconLoader2 size={20} className={styles.spinner} />
                    <span>Cargando géneros...</span>
                  </div>
                ) : (
                  <div className={styles.genreGrid}>
                    {availableGenres.map(genre => {
                      const isSelected = form.selectedGenres.includes(genre.id);
                      const wasOriginallySelected = form.originalGenres.includes(genre.id);
                      const isModified = isSelected !== wasOriginallySelected;

                      return (
                        <button
                          key={genre.id}
                          type="button"
                          className={`
                            ${styles.genreTag} 
                            ${isSelected ? styles.genreSelected : ''} 
                            ${isModified ? styles.genreModified : ''}
                          `}
                          onClick={() => form.toggleGenre(genre.id)}
                          aria-pressed={isSelected}
                        >
                          {isSelected && <IconCheck size={14} />}
                          {genre.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {availableGenres.length === 0 && !genresLoading && (
                  <p className={styles.hint}>No hay géneros disponibles</p>
                )}
                <p className={styles.hint}>
                  {form.selectedGenres.length} género(s) seleccionado(s)
                </p>
              </div>
            </CollapsibleSection>

            {/* Sección de Sinopsis */}
            <CollapsibleSection
              title="Sinopsis"
              icon={IconFileText}
              badge={isFieldModified('synopsis') ? '●' : null}
            >
              <TextFieldWithCounter
                id="synopsis"
                name="synopsis"
                label="Descripción / Sinopsis"
                value={form.formData.synopsis}
                onChange={form.handleChange}
                onBlur={form.handleBlur}
                maxLength={5000}
                error={form.validationErrors.synopsis}
                touched={form.touchedFields.synopsis}
                modified={isFieldModified('synopsis')}
                placeholder="Escribe una descripción detallada de la serie..."
                multiline
                rows={6}
              />
            </CollapsibleSection>

            {/* Resumen de cambios */}
            {form.isDirty() && (
              <div className={styles.changesSummary}>
                <span className={styles.changesSummaryTitle}>
                  Cambios pendientes:
                </span>
                <div className={styles.changesTags}>
                  {changeTypes.metadata && (
                    <span className={styles.changeTag}>Información</span>
                  )}
                  {changeTypes.genres && (
                    <span className={styles.changeTag}>Géneros</span>
                  )}
                  {changeTypes.image && (
                    <span className={styles.changeTag}>Portada</span>
                  )}
                </div>
              </div>
            )}

            {/* Botones de acción */}
            <div className={styles.actions}>
              <button
                type="button"
                onClick={handleClose}
                className={styles.cancelButton}
                disabled={form.isLoading}
              >
                Cancelar
              </button>

              {(changeTypes.metadata || changeTypes.genres) && !changeTypes.image && (
                <button
                  type="button"
                  onClick={handleSaveMetadataOnly}
                  className={styles.secondaryButton}
                  disabled={form.isLoading}
                >
                  {form.loadingStates.metadata ? (
                    <>
                      <IconLoader2 size={18} className={styles.spinner} />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <IconDeviceFloppy size={18} />
                      Guardar Información
                    </>
                  )}
                </button>
              )}

              <button
                type="submit"
                className={styles.saveButton}
                disabled={form.isLoading || !form.isDirty()}
              >
                {form.isLoading ? (
                  <>
                    <IconLoader2 size={18} className={styles.spinner} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <IconDeviceFloppy size={18} />
                    Guardar Todo
                  </>
                )}
              </button>
            </div>

            {/* Atajo de teclado */}
            <p className={styles.shortcutHint}>
              Presiona <kbd>Ctrl</kbd> + <kbd>S</kbd> para guardar
            </p>
          </form>
        </div>
      </div>

      {/* Modal de confirmación de salida */}
      {showExitConfirm && (
        <div className={styles.confirmOverlay} onClick={cancelExit}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3>¿Salir sin guardar?</h3>
            <p>Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?</p>
            <div className={styles.confirmActions}>
              <button onClick={cancelExit} className={styles.cancelButton}>
                Seguir editando
              </button>
              <button onClick={confirmExit} className={styles.dangerButton}>
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Función auxiliar para obtener mensaje de error legible
 */
function getErrorMessage(error) {
  if (!error) {
    console.error('getErrorMessage called with no error');
    return 'Error desconocido';
  }

  // Error con status HTTP
  if (error.status) {
    console.error('getErrorMessage http error', error.status, error.message);
    switch (error.status) {
      case 400:
        return error.message || 'Datos inválidos. Revisa los campos del formulario.';
      case 401:
        return 'Sesión expirada. Por favor, inicia sesión nuevamente.';
      case 403:
        return 'No tienes permisos para realizar esta acción.';
      case 404:
        return 'La serie no fue encontrada.';
      case 413:
        return 'El archivo es demasiado grande.';
      case 429:
        return 'Demasiadas solicitudes. Espera un momento e intenta de nuevo.';
      case 500:
      case 502:
      case 503:
        return 'Error del servidor. Intenta más tarde.';
      default:
        return error.message || `Error ${error.status}`;
    }
  }

  // Error de red
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    console.error('getErrorMessage network error', error.message);
    return 'Error de conexión. Verifica tu internet.';
  }

  return error.message || 'Error desconocido';
}