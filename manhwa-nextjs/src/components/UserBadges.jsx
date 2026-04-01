'use client';

import { useState, useRef } from 'react';
import { Popover, Text } from '@mantine/core';
import { ACHIEVEMENT_CATALOG } from '@/components/achievements/Achievements';
import styles from './UserBadges.module.css';

/* ============================================================
   LÓGICA DE SELECCIÓN DE BADGES
   ============================================================ */

export function selectTopBadges(userStats = {}, maxBadges = 3) {
  const stats = {
    streak: 0,
    nightReads: 0,
    comments: 0,
    totalChapters: 0,
    maxChaptersPerHour: 0,
    ratings: 0,
    ...userStats,
  };

  const BASE_PRIORITY = {
    streak:         100,
    diamante:        80,
    veloz:           60,
    critico:         50,
    lectorNocturno:  40,
    primeraEstrella: 30,
  };

  const unlockedBadges = Object.values(ACHIEVEMENT_CATALOG)
    .filter(achievement => {
      try { return achievement.unlockCondition(stats); }
      catch (_) { return false; }
    })
    .map(achievement => {
      let level = 0;
      try {
        const levelInfo = achievement.getLevelInfo ? achievement.getLevelInfo(stats) : null;
        level = levelInfo?.level ?? 0;
      } catch (_) {}
      const basePriority = BASE_PRIORITY[achievement.id] || 0;
      const priority = basePriority + Math.min(level * 3, 18);
      return { ...achievement, priority, stats };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxBadges);

  return unlockedBadges;
}

/* ============================================================
   COMPONENTE DE BADGE INDIVIDUAL
   ============================================================ */

function BadgeIcon({ badge, size = 'compact', showTooltip = true }) {
  const [opened, setOpened] = useState(false);
  const closeTimer = useRef(null);
  const Icon = badge.icon;

  const iconSize = size === 'compact' ? 13 : 20;
  const containerSize = size === 'compact' ? 20 : 32;

  const open = () => {
    clearTimeout(closeTimer.current);
    setOpened(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpened(false), 200);
  };

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
        border: `1px solid var(--mantine-color-${badge.color}-3)`,
      }}
    >
      <Icon size={iconSize} color={`var(--mantine-color-${badge.color}-7)`} />
    </div>
  );

  if (!showTooltip) return element;

  return (
    <Popover opened={opened} onChange={setOpened} withArrow withinPortal position="top" width={200}>
      <Popover.Target>
        <div onMouseEnter={open} onMouseLeave={scheduleClose} onClick={() => setOpened(o => !o)} style={{ cursor: 'pointer' }}>
          {element}
        </div>
      </Popover.Target>
      <Popover.Dropdown style={{ padding: '10px 14px' }} onMouseEnter={open} onMouseLeave={scheduleClose}>
        <Text fw={700} size="sm" style={{ color: `var(--mantine-color-${badge.color}-7)` }}>
          {badge.label || badge.id}
        </Text>
        <Text size="xs" c="dimmed" mt={2}>
          {badge.id === 'streak'
            ? `Llevas ${badge.stats.streak} día${badge.stats.streak !== 1 ? 's' : ''} leyendo seguido. ¡Sigue así!`
            : badge.description}
        </Text>
        <a href="/perfil#vitrina-logros" style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: `var(--mantine-color-${badge.color}-7)`, textDecoration: 'underline', fontWeight: 600 }} onClick={() => setOpened(false)}>
          Ver más
        </a>
      </Popover.Dropdown>
    </Popover>
  );
}

/* ============================================================
   COMPONENTE PRINCIPAL: UserBadges
   ============================================================ */

export default function UserBadges({
  userStats = {},
  maxBadges = 3,
  size = 'compact',
  showTooltip = true,
}) {
  const topBadges = selectTopBadges(userStats, maxBadges);

  if (topBadges.length === 0) return null;

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
