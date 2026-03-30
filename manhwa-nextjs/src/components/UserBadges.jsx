'use client';

import { Tooltip } from '@mantine/core';
import { StreakFlame } from '@/components/achievements/Logros';
import { ACHIEVEMENT_CATALOG } from '@/components/achievements/Achievements';
import styles from './UserBadges.module.css';

/* ============================================================
   LÓGICA DE SELECCIÓN DE BADGES
   ============================================================ */

/**
 * Prioriza y selecciona los top N badges para mostrar
 * @param {Object} userStats - Estadísticas del usuario
 * @param {number} maxBadges - Cantidad máxima de badges a mostrar (default: 3)
 * @returns {Array} Array de badges desbloqueados, ordenados por prioridad
 */
export function selectTopBadges(userStats = {}, maxBadges = 3) {
  const stats = {
    streak: 0,
    nightReads: 0,
    comments: 0,
    totalChapters: 0,
    maxChaptersPerHour: 0,
    ...userStats,
  };

  // Sistema de prioridad (mayor = más importante)
  const PRIORITY = {
    streak: 100,        // Racha es el más importante
    diamond: 90,        // Diamante (1000 caps)
    guardian: 80,       // Guardián (500 caps)
    devourer: 70,       // Devorador (100 caps)
    speedReader: 60,    // Veloz
    critic: 50,         // Crítico
    nightReader: 40,    // Lector Nocturno
  };

  // Filtrar badges desbloqueados y ordenar por prioridad
  const unlockedBadges = Object.values(ACHIEVEMENT_CATALOG)
    .filter(achievement => achievement.unlockCondition(stats))
    .map(achievement => ({
      ...achievement,
      priority: PRIORITY[achievement.id] || 0,
      stats, // Pasar stats para renderizar valores dinámicos
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxBadges);

  return unlockedBadges;
}

/* ============================================================
   COMPONENTE DE BADGE INDIVIDUAL
   ============================================================ */

function BadgeIcon({ badge, size = 'compact', showTooltip = true }) {
  const Icon = badge.icon;

  // Renderizado especial para racha
  if (badge.id === 'streak') {
    const element = (
      <div className={styles.badgeWrapper}>
        <StreakFlame 
          streak={badge.stats.streak} 
          iconOnly 
        />
      </div>
    );

    if (!showTooltip) return element;

    return (
      <Tooltip 
        label={`🔥 Racha de ${badge.stats.streak} día${badge.stats.streak !== 1 ? 's' : ''}`}
        withArrow
        position="top"
      >
        {element}
      </Tooltip>
    );
  }

  // Otros badges
  const iconSize = size === 'compact' ? 16 : 20;
  const containerSize = size === 'compact' ? 24 : 32;

  const element = (
    <div 
      className={styles.badgeWrapper}
      style={{
        width: containerSize,
        height: containerSize,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `var(--mantine-color-${badge.color}-1)`,
        border: `2px solid var(--mantine-color-${badge.color}-3)`,
      }}
    >
      <Icon size={iconSize} color={`var(--mantine-color-${badge.color}-7)`} />
    </div>
  );

  if (!showTooltip) return element;

  return (
    <Tooltip 
      label={badge.description}
      withArrow
      position="top"
    >
      {element}
    </Tooltip>
  );
}

/* ============================================================
   COMPONENTE PRINCIPAL: UserBadges
   ============================================================ */

/**
 * Muestra los badges desbloqueados del usuario (máx 3)
 * Se coloca en el borde superior del comentario
 * 
 * @param {Object} userStats - Estadísticas del usuario
 * @param {number} maxBadges - Cantidad máxima de badges (default: 3)
 * @param {string} size - Tamaño: 'compact' | 'normal' (default: 'compact')
 * @param {boolean} showTooltip - Mostrar tooltip al hover (default: true)
 */
export default function UserBadges({ 
  userStats = {}, 
  maxBadges = 3,
  size = 'compact',
  showTooltip = true,
}) {
  const topBadges = selectTopBadges(userStats, maxBadges);

  if (topBadges.length === 0) {
    return null;
  }

  return (
    <div className={styles.badgesContainer}>
      <div className={styles.badgesGroup}>
        {topBadges.map((badge) => (
          <BadgeIcon
            key={badge.id}
            badge={badge}
            size={size}
            showTooltip={showTooltip}
          />
        ))}
      </div>
    </div>
  );
}
