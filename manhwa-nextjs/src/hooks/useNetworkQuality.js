import { useState, useEffect } from 'react';

/**
 * Hook para detectar calidad de conexión de red
 * Usa Network Information API con fallback a medición de velocidad
 * 
 * @returns {Object} - { effectiveType, quality, isSlowConnection, savingData }
 */
export function useNetworkQuality() {
  const [networkInfo, setNetworkInfo] = useState({
    effectiveType: '4g', // slow-2g, 2g, 3g, 4g
    quality: 'high', // low, medium, high
    isSlowConnection: false,
    savingData: false,
    downlink: null, // Mbps
    rtt: null // ms
  });

  useEffect(() => {
    // Verificar soporte de Network Information API
    const connection = 
      navigator.connection || 
      navigator.mozConnection || 
      navigator.webkitConnection;

    if (!connection) {
      // Fallback: asumir conexión decente si no hay API
      setNetworkInfo(prev => ({ ...prev, quality: 'high' }));
      return;
    }

    const updateNetworkInfo = () => {
      const effectiveType = connection.effectiveType || '4g';
      const savingData = connection.saveData || false;
      const downlink = connection.downlink || null;
      const rtt = connection.rtt || null;

      // Determinar calidad basada en effectiveType
      let quality = 'high';
      let isSlowConnection = false;

      switch (effectiveType) {
        case 'slow-2g':
        case '2g':
          quality = 'low';
          isSlowConnection = true;
          break;
        case '3g':
          quality = 'medium';
          isSlowConnection = true;
          break;
        case '4g':
        default:
          quality = 'high';
          isSlowConnection = false;
          break;
      }

      // Ajustar por saveData
      if (savingData) {
        quality = 'low';
        isSlowConnection = true;
      }

      // Ajustar por downlink si está disponible
      if (downlink !== null) {
        if (downlink < 0.5) {
          quality = 'low';
          isSlowConnection = true;
        } else if (downlink < 2) {
          quality = 'medium';
          isSlowConnection = true;
        }
      }

      setNetworkInfo({
        effectiveType,
        quality,
        isSlowConnection,
        savingData,
        downlink,
        rtt
      });
    };

    // Actualizar al montar
    updateNetworkInfo();

    // Escuchar cambios de conexión
    connection.addEventListener('change', updateNetworkInfo);

    return () => {
      connection.removeEventListener('change', updateNetworkInfo);
    };
  }, []);

  return networkInfo;
}

/**
 * Obtener configuración de imagen basada en calidad de red
 */
export function getImageConfigForNetwork(quality, dataSaverMode = false) {
  if (dataSaverMode) {
    return {
      quality: 50,
      maxWidth: 600,
      format: 'webp',
      preloadCount: 0,
      enableBlur: false
    };
  }

  switch (quality) {
    case 'low':
      return {
        quality: 60,
        maxWidth: 800,
        format: 'webp',
        preloadCount: 1,
        enableBlur: true
      };
    case 'medium':
      return {
        quality: 75,
        maxWidth: 1000,
        format: 'webp',
        preloadCount: 2,
        enableBlur: true
      };
    case 'high':
    default:
      return {
        quality: 85,
        maxWidth: 1600,
        format: 'webp',
        preloadCount: 3,
        enableBlur: true
      };
  }
}

/**
 * Hook para medir velocidad de descarga real
 * Útil cuando Network Information API no está disponible
 */
export function useMeasuredSpeed() {
  const [speed, setSpeed] = useState(null); // Mbps
  const [measuring, setMeasuring] = useState(false);

  const measureSpeed = async () => {
    setMeasuring(true);
    try {
      // Descargar una imagen pequeña de prueba (100KB aprox)
      const testImageUrl = '/test-image.jpg?' + Date.now(); // Cache bust
      const startTime = Date.now();
      
      const response = await fetch(testImageUrl);
      const blob = await response.blob();
      
      const endTime = Date.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const fileSizeBytes = blob.size;
      const fileSizeMB = fileSizeBytes / (1024 * 1024);
      const speedMbps = (fileSizeMB * 8) / durationSeconds;

      setSpeed(speedMbps);
    } catch (error) {
      console.error('Error midiendo velocidad:', error);
      setSpeed(null);
    } finally {
      setMeasuring(false);
    }
  };

  return { speed, measuring, measureSpeed };
}
