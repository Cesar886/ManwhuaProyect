import React from 'react';
import { IconWifi, IconWifiOff, IconDownload, IconPhoto, IconBolt } from '@tabler/icons-react';
import classes from './LoadingIndicators.module.css';

/**
 * Indicador de progreso de carga de imágenes
 */
export function ImageLoadProgress({ loaded, total, bytesLoaded }) {
  const progress = total > 0 ? (loaded / total) * 100 : 0;
  const bytesMB = (bytesLoaded / 1024 / 1024).toFixed(2);

  if (total === 0 || loaded >= total) return null;

  return (
    <div className={classes.progressBar}>
      <div className={classes.progressInfo}>
        <IconPhoto size={16} />
        <span>Cargando imágenes: {loaded}/{total}</span>
        <span className={classes.bytes}>{bytesMB} MB</span>
      </div>
      <div className={classes.progressTrack}>
        <div 
          className={classes.progressFill}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Indicador de velocidad de conexión
 */
export function ConnectionIndicator({ networkInfo, dataSaverMode }) {
  const { effectiveType, quality, isSlowConnection, downlink, rtt } = networkInfo;

  const getIcon = () => {
    if (dataSaverMode) return <IconBolt size={16} className={classes.iconSaver} />;
    if (isSlowConnection) return <IconWifiOff size={16} className={classes.iconSlow} />;
    return <IconWifi size={16} className={classes.iconFast} />;
  };

  const getLabel = () => {
    if (dataSaverMode) return 'Modo Ahorro';
    
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        return '2G - Muy Lento';
      case '3g':
        return '3G - Lento';
      case '4g':
      default:
        return '4G - Rápido';
    }
  };

  const getQualityLabel = () => {
    switch (quality) {
      case 'low':
        return 'Calidad: Baja (60%)';
      case 'medium':
        return 'Calidad: Media (75%)';
      case 'high':
      default:
        return 'Calidad: Alta (85%)';
    }
  };

  return (
    <div className={`${classes.connectionBadge} ${classes[quality]}`}>
      {getIcon()}
      <div className={classes.connectionInfo}>
        <div className={classes.connectionType}>{getLabel()}</div>
        <div className={classes.connectionQuality}>{getQualityLabel()}</div>
        {downlink && (
          <div className={classes.connectionDetails}>
            {downlink.toFixed(1)} Mbps {rtt && `• ${rtt}ms`}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mensaje de conexión lenta
 */
export function SlowConnectionBanner({ onEnableDataSaver, dataSaverMode }) {
  if (dataSaverMode) {
    return (
      <div className={classes.banner}>
        <IconBolt size={20} />
        <div className={classes.bannerContent}>
          <strong>Modo Ahorro Activado</strong>
          <p>Imágenes optimizadas para ahorrar datos</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${classes.banner} ${classes.warning}`}>
      <IconWifiOff size={20} />
      <div className={classes.bannerContent}>
        <strong>Conexión Lenta Detectada</strong>
        <p>Cargando imágenes optimizadas. ¿Quieres activar modo ahorro?</p>
      </div>
      <button 
        className={classes.bannerButton}
        onClick={onEnableDataSaver}
      >
        Activar
      </button>
    </div>
  );
}

/**
 * Skeleton loader para imágenes
 */
export function ImageSkeleton({ aspectRatio = '3/4', className }) {
  return (
    <div 
      className={`${classes.skeleton} ${className || ''}`}
      style={{ aspectRatio }}
    >
      <div className={classes.skeletonShimmer} />
      <div className={classes.skeletonIcon}>
        <IconPhoto size={48} />
      </div>
    </div>
  );
}

/**
 * Indicador de precarga
 */
export function PreloadIndicator({ visible }) {
  if (!visible) return null;

  return (
    <div className={classes.preloadBadge}>
      <IconDownload size={14} />
      <span>Precargando siguiente...</span>
    </div>
  );
}

/**
 * Panel de configuración de optimización
 */
export function OptimizationSettings({ 
  dataSaverMode, 
  onToggleDataSaver,
  forcedQuality,
  onQualityChange,
  virtualScrollEnabled,
  onToggleVirtualScroll,
  cacheSize
}) {
  return (
    <div className={classes.settings}>
      <h3 className={classes.settingsTitle}>Optimización de Imágenes</h3>
      
      {/* Modo Ahorro de Datos */}
      <div className={classes.settingItem}>
        <label className={classes.settingLabel}>
          <input
            type="checkbox"
            checked={dataSaverMode}
            onChange={(e) => onToggleDataSaver(e.target.checked)}
            className={classes.checkbox}
          />
          <div>
            <strong>Modo Ahorro de Datos</strong>
            <p className={classes.settingDescription}>
              Reduce calidad y tamaño de imágenes (50% calidad, max 600px)
            </p>
          </div>
        </label>
      </div>

      {/* Calidad Forzada */}
      <div className={classes.settingItem}>
        <label className={classes.settingLabel}>
          <strong>Calidad de Imagen</strong>
        </label>
        <select
          value={forcedQuality || 'auto'}
          onChange={(e) => onQualityChange(e.target.value === 'auto' ? null : e.target.value)}
          className={classes.select}
          disabled={dataSaverMode}
        >
          <option value="auto">Automática (según conexión)</option>
          <option value="low">Baja (60% - ~100KB)</option>
          <option value="medium">Media (75% - ~200KB)</option>
          <option value="high">Alta (85% - ~400KB)</option>
        </select>
      </div>

      {/* Virtual Scroll */}
      <div className={classes.settingItem}>
        <label className={classes.settingLabel}>
          <input
            type="checkbox"
            checked={virtualScrollEnabled}
            onChange={(e) => onToggleVirtualScroll(e.target.checked)}
            className={classes.checkbox}
          />
          <div>
            <strong>Scroll Virtualizado</strong>
            <p className={classes.settingDescription}>
              Mejora rendimiento en capítulos largos (activa automático con 30+ imágenes)
            </p>
          </div>
        </label>
      </div>

      {/* Caché */}
      {cacheSize !== undefined && (
        <div className={classes.settingItem}>
          <div className={classes.cacheInfo}>
            <strong>Caché de Imágenes</strong>
            <p className={classes.settingDescription}>
              {cacheSize} MB almacenados localmente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
