'use client'

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNetworkQuality, getImageConfigForNetwork } from '../hooks/useNetworkQuality';

/**
 * Contexto para gestionar modo de ahorro de datos
 * y configuración de optimización de imágenes
 */
const ImageOptimizationContext = createContext(null);

export function ImageOptimizationProvider({ children }) {
  // Modo ahorro de datos (manual)
  const [dataSaverMode, setDataSaverMode] = useState(false);

  // Calidad forzada por usuario (null = automática)
  const [forcedQuality, setForcedQuality] = useState(null);

  // Virtualización activada
  const [virtualScrollEnabled, setVirtualScrollEnabled] = useState(true);

  // Load from localStorage after mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDataSaver = localStorage.getItem('dataSaverMode');
      if (savedDataSaver) setDataSaverMode(JSON.parse(savedDataSaver));

      const savedQuality = localStorage.getItem('forcedQuality');
      if (savedQuality) setForcedQuality(savedQuality);

      const savedVirtualScroll = localStorage.getItem('virtualScrollEnabled');
      if (savedVirtualScroll) setVirtualScrollEnabled(JSON.parse(savedVirtualScroll));
    }
  }, []);

  // Detección automática de red
  const networkInfo = useNetworkQuality();

  // Determinar calidad efectiva
  const effectiveQuality = forcedQuality || networkInfo.quality;

  // Obtener configuración de imágenes
  const imageConfig = getImageConfigForNetwork(effectiveQuality, dataSaverMode);

  // Estadísticas de carga
  const [loadStats, setLoadStats] = useState({
    imagesLoaded: 0,
    totalImages: 0,
    bytesLoaded: 0,
    failedImages: 0
  });

  // Guardar preferencias en localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dataSaverMode', JSON.stringify(dataSaverMode));
    }
  }, [dataSaverMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (forcedQuality) {
        localStorage.setItem('forcedQuality', forcedQuality);
      } else {
        localStorage.removeItem('forcedQuality');
      }
    }
  }, [forcedQuality]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('virtualScrollEnabled', JSON.stringify(virtualScrollEnabled));
    }
  }, [virtualScrollEnabled]);

  // Funciones para actualizar estadísticas
  const incrementLoadedImages = () => {
    setLoadStats(prev => ({
      ...prev,
      imagesLoaded: prev.imagesLoaded + 1
    }));
  };

  const incrementFailedImages = () => {
    setLoadStats(prev => ({
      ...prev,
      failedImages: prev.failedImages + 1
    }));
  };

  const setTotalImages = (total) => {
    setLoadStats(prev => ({
      ...prev,
      totalImages: total,
      imagesLoaded: 0,
      failedImages: 0
    }));
  };

  const addBytesLoaded = (bytes) => {
    setLoadStats(prev => ({
      ...prev,
      bytesLoaded: prev.bytesLoaded + bytes
    }));
  };

  const resetStats = () => {
    setLoadStats({
      imagesLoaded: 0,
      totalImages: 0,
      bytesLoaded: 0,
      failedImages: 0
    });
  };

  // Calcular progreso
  const loadProgress = loadStats.totalImages > 0
    ? Math.round((loadStats.imagesLoaded / loadStats.totalImages) * 100)
    : 0;

  const value = {
    // Estado
    dataSaverMode,
    forcedQuality,
    virtualScrollEnabled,
    networkInfo,
    effectiveQuality,
    imageConfig,
    
    // Funciones de control
    setDataSaverMode,
    setForcedQuality,
    setVirtualScrollEnabled,
    
    // Estadísticas
    loadStats,
    loadProgress,
    incrementLoadedImages,
    incrementFailedImages,
    setTotalImages,
    addBytesLoaded,
    resetStats,
    
    // Utilidades
    isSlowConnection: networkInfo.isSlowConnection || dataSaverMode,
    shouldUseVirtualScroll: (imageCount) => {
      return virtualScrollEnabled && imageCount > 30;
    }
  };

  return (
    <ImageOptimizationContext.Provider value={value}>
      {children}
    </ImageOptimizationContext.Provider>
  );
}

/**
 * Hook para usar el contexto
 */
export function useImageOptimization() {
  const context = useContext(ImageOptimizationContext);
  
  if (!context) {
    throw new Error('useImageOptimization debe usarse dentro de ImageOptimizationProvider');
  }
  
  return context;
}

/**
 * Hook para obtener solo la configuración de imágenes
 * Útil para componentes que solo necesitan la config
 */
export function useImageConfig() {
  const { imageConfig, effectiveQuality, networkInfo } = useImageOptimization();
  
  return {
    ...imageConfig,
    quality: effectiveQuality,
    connectionType: networkInfo.effectiveType
  };
}
