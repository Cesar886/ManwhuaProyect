import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';

/**
 * Hook personalizado para gestión del formulario de edición de series
 * Maneja:
 * - Estado del formulario
 * - Detección de cambios (dirty state)
 * - Validación
 * - Estados de carga independientes
 * - Auto-save en drafts
 */

const DRAFT_KEY_PREFIX = 'series_draft_';
const AUTO_SAVE_DELAY = 30000; // 30 segundos

// Esquema de validación
const validationRules = {
  title: {
    required: true,
    maxLength: 500,
    pattern: null,
    message: 'El título es requerido (máximo 500 caracteres)'
  },
  originalTitle: {
    required: false,
    maxLength: 500,
    message: 'Máximo 500 caracteres'
  },
  author: {
    required: false,
    maxLength: 200,
    message: 'Máximo 200 caracteres'
  },
  synopsis: {
    required: false,
    maxLength: 5000,
    message: 'Máximo 5000 caracteres'
  },
  releaseYear: {
    required: false,
    min: 1900,
    max: new Date().getFullYear() + 5,
    message: 'Año inválido (1900 - presente)'
  }
};

/**
 * Valida un campo individual
 */
const validateField = (name, value) => {
  const rule = validationRules[name];
  if (!rule) return null;

  // Campo requerido
  if (rule.required && (!value || value.toString().trim() === '')) {
    return rule.message || `${name} es requerido`;
  }

  // Longitud máxima
  if (rule.maxLength && value && value.toString().length > rule.maxLength) {
    return `Máximo ${rule.maxLength} caracteres (actual: ${value.length})`;
  }

  // Rango numérico
  if (rule.min !== undefined && rule.max !== undefined) {
    const num = parseInt(value, 10);
    if (value && (isNaN(num) || num < rule.min || num > rule.max)) {
      return rule.message;
    }
  }

  // Patrón regex
  if (rule.pattern && value && !rule.pattern.test(value)) {
    return rule.message;
  }

  return null;
};

/**
 * Valida todos los campos del formulario
 */
const validateForm = (formData) => {
  const errors = {};
  let isValid = true;

  Object.keys(validationRules).forEach(field => {
    const error = validateField(field, formData[field]);
    if (error) {
      errors[field] = error;
      isValid = false;
    }
  });

  return { isValid, errors };
};

/**
 * Compara dos objetos para detectar cambios
 */
const hasChanges = (current, original) => {
  if (!original) return false;
  return Object.keys(current).some(key => {
    const currentVal = current[key];
    const originalVal = original[key];
    
    // Normalizar valores vacíos
    const normCurrent = currentVal === '' || currentVal === null || currentVal === undefined ? '' : currentVal;
    const normOriginal = originalVal === '' || originalVal === null || originalVal === undefined ? '' : originalVal;
    
    return normCurrent !== normOriginal;
  });
};

/**
 * Compara arrays de géneros
 */
const hasGenreChanges = (current, original) => {
  if (!original) return false;
  const sortedCurrent = [...current].sort();
  const sortedOriginal = [...original].sort();
  return JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOriginal);
};

export default function useSeriesForm(series, isOpen, availableGenres) {
  // Estado del formulario
  const [formData, setFormData] = useState({
    title: '',
    originalTitle: '',
    author: '',
    synopsis: '',
    status: 'ongoing',
    contentType: 'manhwa',
    releaseYear: '',
    isAdult: false,
    isFeatured: false,
    isHot: false
  });

  // Géneros
  const [selectedGenres, setSelectedGenres] = useState([]);
  
  // Estado original para comparar
  const [originalData, setOriginalData] = useState(null);
  const [originalGenres, setOriginalGenres] = useState([]);

  // Imagen
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [originalCoverUrl, setOriginalCoverUrl] = useState(null);

  // Estados de carga independientes
  const [loadingStates, setLoadingStates] = useState({
    metadata: false,
    image: false,
    genres: false
  });

  // Errores de validación
  const [validationErrors, setValidationErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  // Estado de campos tocados
  const [touchedFields, setTouchedFields] = useState({});

  // Ref para auto-save timer
  const autoSaveTimer = useRef(null);

  // Draft key único para esta serie
  const draftKey = series?.slug ? `${DRAFT_KEY_PREFIX}${series.slug}` : null;

  /**
   * Inicializar formulario con datos de la serie
   * Usamos useLayoutEffect para evitar flash visual ya que esta es una inicialización
   * que debe ocurrir antes del primer render visible
   */
  useLayoutEffect(() => {
    // initTimer se usa para diferir las llamadas a setState y permitir limpieza
    let initTimer;

    if (series && isOpen) {
      // Intentar recuperar draft guardado
      let draftData = null;
      if (draftKey) {
        try {
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            // Verificar que el draft no sea muy antiguo (24 horas)
            if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
              draftData = parsed.data;
            } else {
              localStorage.removeItem(draftKey);
            }
          }
        } catch (e) {
          console.warn('Error al cargar draft:', e);
        }
      }

      // Extraer géneros actuales
      const currentGenreIds = Array.isArray(series.genres)
        ? series.genres.map(g => (typeof g === 'object' ? g.id : g))
        : [];

      const initialData = {
        title: series.title || '',
        originalTitle: series.alternativeTitle || series.originalTitle || series.original_title || '',
        author: series.author || '',
        synopsis: series.synopsis || series.description || '',
        status: series.status || 'ongoing',
        contentType: series.contentType || series.content_type || series.type || 'manhwa',
        releaseYear: series.releaseYear || series.release_year || '',
        isAdult: series.isAdult || series.is_adult || false,
        isFeatured: series.isFeatured || series.is_featured || false,
        isHot: series.isHot || series.is_hot || false
      };

      // Preparar valores que se aplicarán
      const toSetForm = draftData?.formData || initialData;
      const toSetGenres = draftData?.genres || currentGenreIds;
      const coverUrl = series.cover || series.coverUrl || series.cover_url || null;

      // Diferir actualizaciones de estado para evitar renders en cascada sincronizados
      initTimer = setTimeout(() => {
        setFormData(toSetForm);
        setOriginalData(initialData);
        setSelectedGenres(toSetGenres);
        setOriginalGenres(currentGenreIds);
        setCoverPreview(coverUrl);
        setOriginalCoverUrl(coverUrl);
        setCoverFile(null);

        // Reset estados
        setValidationErrors({});
        setSubmitError('');
        setSubmitSuccess('');
        setTouchedFields({});
        setLoadingStates({ metadata: false, image: false, genres: false });
      }, 0);
    }

    // Cleanup: limpiar timers (init + auto-save)
    return () => {
      if (initTimer) clearTimeout(initTimer);
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [series, isOpen, draftKey]);

  /**
   * Auto-save en localStorage
   */
  useEffect(() => {
    if (!isOpen || !draftKey) return;

    // Solo guardar si hay cambios
    const dataChanged = hasChanges(formData, originalData);
    const genresChanged = hasGenreChanges(selectedGenres, originalGenres);

    if (!dataChanged && !genresChanged) return;

    // Debounce auto-save
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    autoSaveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          data: { formData, genres: selectedGenres },
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Error al guardar draft:', e);
      }
    }, AUTO_SAVE_DELAY);
  }, [formData, selectedGenres, isOpen, draftKey, originalData, originalGenres]);

  /**
   * Manejar cambio de campo
   */
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Marcar campo como tocado
    setTouchedFields(prev => ({
      ...prev,
      [name]: true
    }));

    // Validar campo en tiempo real
    const error = validateField(name, newValue);
    setValidationErrors(prev => ({
      ...prev,
      [name]: error
    }));

    // Limpiar error de submit cuando el usuario hace cambios
    if (submitError) {
      setSubmitError('');
    }
  }, [submitError]);

  /**
   * Manejar blur de campo (para validación)
   */
  const handleBlur = useCallback((e) => {
    const { name, value } = e.target;
    
    setTouchedFields(prev => ({
      ...prev,
      [name]: true
    }));

    const error = validateField(name, value);
    setValidationErrors(prev => ({
      ...prev,
      [name]: error
    }));
  }, []);

  /**
   * Toggle género
   */
  const toggleGenre = useCallback((genreId) => {
    setSelectedGenres(prev => {
      if (prev.includes(genreId)) {
        return prev.filter(id => id !== genreId);
      }
      return [...prev, genreId];
    });
  }, []);

  /**
   * Manejar archivo de imagen
   */
  const handleFileChange = useCallback((file) => {
    if (!file) return { success: false, error: 'No se seleccionó archivo' };

    // Validar tamaño (5MB máximo)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return { success: false, error: 'La imagen no puede ser mayor a 5MB' };
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Formato no soportado. Use JPG, PNG, WebP o GIF' };
    }

    // Validar magic bytes (primeros bytes del archivo)
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverFile(file);
        setCoverPreview(reader.result);
        resolve({ success: true });
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Error al leer el archivo' });
      };
      reader.readAsDataURL(file);
    });
  }, []);

  /**
   * Manejar drop de imagen (drag & drop)
   */
  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      return handleFileChange(file);
    }
    return { success: false, error: 'No se detectó archivo' };
  }, [handleFileChange]);

  /**
   * Manejar paste de imagen desde clipboard
   */
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          handleFileChange(file);
          break;
        }
      }
    }
  }, [handleFileChange]);

  /**
   * Remover imagen seleccionada
   */
  const removeSelectedImage = useCallback(() => {
    setCoverFile(null);
    setCoverPreview(originalCoverUrl);
  }, [originalCoverUrl]);

  /**
   * Calcular campos que han cambiado
   * IMPORTANTE: Nunca incluir 'slug' - es inmutable en el servidor
   */
  const getChangedFields = useCallback(() => {
    if (!originalData) return {};

    const changes = {};
    
    // Campos que NUNCA deben ser enviados al servidor
    const immutableFields = ['slug', 'id', 'createdAt', 'created_at'];

    // Comparar campos de texto y booleanos
    Object.keys(formData).forEach(key => {
      // NUNCA incluir campos inmutables
      if (immutableFields.includes(key)) return;
      
      const current = formData[key];
      const original = originalData[key];

      // Normalizar valores
      const normCurrent = current === '' || current === null || current === undefined ? '' : current;
      const normOriginal = original === '' || original === null || original === undefined ? '' : original;

      if (normCurrent !== normOriginal && normCurrent !== '') {
        changes[key] = current;
      }
    });

    // Comparar géneros
    if (hasGenreChanges(selectedGenres, originalGenres)) {
      const genreNames = selectedGenres
        .map(id => availableGenres.find(g => g.id === id)?.name)
        .filter(Boolean);
      changes.genres = genreNames;
    }

    return changes;
  }, [formData, originalData, selectedGenres, originalGenres, availableGenres]);

  /**
   * Calcular estado "dirty" (hay cambios sin guardar)
   */
  const isDirty = useCallback(() => {
    const dataChanged = hasChanges(formData, originalData);
    const genresChanged = hasGenreChanges(selectedGenres, originalGenres);
    const imageChanged = coverFile !== null;
    return dataChanged || genresChanged || imageChanged;
  }, [formData, originalData, selectedGenres, originalGenres, coverFile]);

  /**
   * Calcular qué tipos de cambios hay
   */
  const getChangeTypes = useCallback(() => {
    return {
      metadata: hasChanges(formData, originalData),
      genres: hasGenreChanges(selectedGenres, originalGenres),
      image: coverFile !== null
    };
  }, [formData, originalData, selectedGenres, originalGenres, coverFile]);

  /**
   * Validar formulario completo
   */
  const validate = useCallback(() => {
    const { isValid, errors } = validateForm(formData);
    setValidationErrors(errors);
    return isValid;
  }, [formData]);

  /**
   * Reset a valores originales
   */
  const resetForm = useCallback(() => {
    if (originalData) {
      setFormData(originalData);
      setSelectedGenres(originalGenres);
      setCoverFile(null);
      setCoverPreview(originalCoverUrl);
      setValidationErrors({});
      setTouchedFields({});
      setSubmitError('');
      setSubmitSuccess('');
    }
  }, [originalData, originalGenres, originalCoverUrl]);

  /**
   * Limpiar draft guardado
   */
  const clearDraft = useCallback(() => {
    if (draftKey) {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  /**
   * Establecer estado de carga
   */
  const setLoading = useCallback((type, isLoading) => {
    setLoadingStates(prev => ({
      ...prev,
      [type]: isLoading
    }));
  }, []);

  /**
   * Verificar si hay alguna operación en curso
   */
  const isLoading = loadingStates.metadata || loadingStates.image || loadingStates.genres;

  /**
   * Obtener conteo de caracteres para un campo
   */
  const getCharCount = useCallback((field) => {
    const value = formData[field] || '';
    const maxLength = validationRules[field]?.maxLength;
    return {
      current: value.length,
      max: maxLength,
      isNearLimit: maxLength && value.length > maxLength * 0.9,
      isOverLimit: maxLength && value.length > maxLength
    };
  }, [formData]);

  return {
    // Estado del formulario
    formData,
    selectedGenres,
    coverFile,
    coverPreview,
    
    // Estado de cambios
    isDirty,
    getChangedFields,
    getChangeTypes,
    
    // Validación
    validationErrors,
    touchedFields,
    validate,
    getCharCount,
    
    // Errores y éxito
    submitError,
    setSubmitError,
    submitSuccess,
    setSubmitSuccess,
    
    // Estados de carga
    loadingStates,
    isLoading,
    setLoading,
    
    // Acciones
    handleChange,
    handleBlur,
    toggleGenre,
    handleFileChange,
    handleFileDrop,
    handlePaste,
    removeSelectedImage,
    resetForm,
    clearDraft,
    
    // Estado original para comparación
    originalData,
    originalGenres,
    originalCoverUrl
  };
}
