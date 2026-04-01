'use client';

import {
  Paper, Stack, Group, SimpleGrid,
  Box, ThemeIcon, Text, Badge, Tooltip, rem,
} from '@mantine/core';
import {
  IconTrophy, IconSparkles,
  IconMoon, IconMessage,
  IconBolt, IconDiamond,
  IconStar, IconFlame,
} from '@tabler/icons-react';
import profileStyles from '@/app/user-profile/UserProfile.module.css';
import styles from './Achievements.module.css';

/* ============================================================
   SISTEMA DE NIVELES MULTINIVEL
   ============================================================ */

const LEVEL_NAMES = ['Bronce', 'Plata', 'Oro', 'Zafiro', 'Rubí', 'Diamante', 'Legendario', 'Mítico'];

/**
 * Calcula el nivel actual y el progreso hacia el siguiente.
 * @param {number} value  - Valor actual del usuario
 * @param {number[]} thresholds - Umbrales [L1, L2, L3, ...] (hasta 6 base)
 * @param {boolean} infinite    - Si true, los niveles continúan más allá del último umbral
 * @returns {{ level, name, nextThreshold, currentValue }}
 */
function getLevelInfo(value, thresholds, infinite = false) {
  const v = Math.max(0, Number(value) || 0);
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (v >= thresholds[i]) level = i + 1;
    else break;
  }

  // Niveles infinitos: doblar el último umbral por cada nivel extra
  // Límite de seguridad: máximo 50 niveles extra para evitar loops infinitos
  if (infinite && level >= thresholds.length) {
    let t = thresholds[thresholds.length - 1];
    let extra = 0;
    while (v >= t * 2 && extra < 50) {
      level++;
      t *= 2;
      extra++;
    }
  }

  // Calcular umbral del siguiente nivel
  let nextThreshold;
  if (level < thresholds.length) {
    nextThreshold = thresholds[level];
  } else if (infinite) {
    let t = thresholds[thresholds.length - 1];
    for (let i = thresholds.length; i < level; i++) t *= 2;
    nextThreshold = t * 2;
  } else {
    nextThreshold = null; // nivel máximo
  }

  return {
    level,
    name: level > 0 ? (LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)]) : null,
    nextThreshold,
    currentValue: v,
  };
}

function fmtNum(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000)    return `${Math.round(v / 1_000)}K`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
  return `${v}`;
}

/* ── Niveles de Racha ── */
const STREAK_LEVELS = [
  { min: 0,  max: 0,    outer: '#475569', mid: '#94a3b8', core: '#e2e8f0', glow: '71,85,105',   name: 'Sin racha' },
  { min: 1,  max: 6,    outer: '#dc2626', mid: '#f97316', core: '#fef3c7', glow: '249,115,22',  name: 'Principiante' },
  { min: 7,  max: 13,   outer: '#ea580c', mid: '#f59e0b', core: '#fef9c3', glow: '234,88,12',   name: 'En desarrollo' },
  { min: 14, max: 29,   outer: '#1d4ed8', mid: '#06b6d4', core: '#e0f2fe', glow: '6,182,212',   name: 'Avanzado' },
  { min: 30, max: 59,   outer: '#7c3aed', mid: '#ec4899', core: '#fdf4ff', glow: '139,92,246',  name: 'Maestro' },
  { min: 60, max: Infinity, outer: '#0e7490', mid: '#8b5cf6', core: '#ecfeff', glow: '14,116,185', name: 'Legendario' },
];

function getStreakLevel(streak) {
  if (!streak || streak <= 0) return STREAK_LEVELS[0];
  return (
    STREAK_LEVELS.slice(1).find(l => streak >= l.min && streak <= l.max) ??
    STREAK_LEVELS[STREAK_LEVELS.length - 1]
  );
}

function fmtStreak(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

/* ── Chispas / embers ── */
const SPARKS = [
  { cx: 24, cy: 74, dx: '-12px', delay: '0s',    dur: '1.4s'  },
  { cx: 40, cy: 72, dx: '10px',  delay: '0.5s',  dur: '1.1s'  },
  { cx: 32, cy: 70, dx: '-5px',  delay: '0.85s', dur: '1.6s'  },
  { cx: 44, cy: 76, dx: '14px',  delay: '1.25s', dur: '1.2s'  },
  { cx: 26, cy: 78, dx: '-16px', delay: '0.3s',  dur: '1.85s' },
  { cx: 36, cy: 73, dx: '7px',   delay: '0.65s', dur: '1.3s'  },
];

/* ============================================================
   CATÁLOGO COMPLETO DE LOGROS
   ============================================================ */
export const ACHIEVEMENT_CATALOG = {

  /* ── Llama Eterna: racha de días consecutivos ── */
  llamaEterna: {
    id: 'llamaEterna',
    label: 'Llama\nEterna',
    description: 'Mantén una racha de 30 días seguidos para desbloquear',
    unlockCondition: (stats) => (stats.streak ?? 0) >= 30,
    getLevelInfo: (stats) =>
      getLevelInfo(stats.streak ?? 0, [30, 60, 90, 180, 365]),
    icon: IconFlame,
    color: 'orange',
  },

  /* ── Diamante: capítulos totales leídos (6 niveles) ── */
  diamante: {
    id: 'diamante',
    label: 'Diamante',
    description: 'Lee 100 capítulos para desbloquear',
    unlockCondition: (stats) => stats.totalChapters >= 100,
    getLevelInfo: (stats) =>
      getLevelInfo(stats.totalChapters, [100, 1_000, 10_000, 50_000, 100_000, 500_000]),
    icon: IconDiamond,
    color: 'blue',
  },

  /* ── Veloz: máximo capítulos en 1 hora (6 niveles) ── */
  veloz: {
    id: 'veloz',
    label: 'Veloz',
    description: 'Lee 100 capítulos en 1 hora para desbloquear',
    unlockCondition: (stats) => stats.maxChaptersPerHour >= 100,
    getLevelInfo: (stats) =>
      getLevelInfo(stats.maxChaptersPerHour, [100, 200, 300, 400, 500, 600]),
    icon: IconBolt,
    color: 'yellow',
  },

  /* ── Crítico: comentarios publicados (infinito) ── */
  critico: {
    id: 'critico',
    label: 'Crítico',
    description: 'Publica 10 comentarios para desbloquear',
    unlockCondition: (stats) => stats.comments >= 10,
    getLevelInfo: (stats) =>
      getLevelInfo(stats.comments, [10, 50, 100, 500, 1_000, 5_000, 10_000, 50_000], true),
    icon: IconMessage,
    color: 'cyan',
    infinite: true,
  },

  /* ── Lector Nocturno: noches distintas de madrugada (6 niveles) ── */
  lectorNocturno: {
    id: 'lectorNocturno',
    label: 'Lector\nNocturno',
    description: 'Lee de madrugada 30 noches para desbloquear',
    unlockCondition: (stats) => stats.nightReads >= 30,
    getLevelInfo: (stats) =>
      getLevelInfo(stats.nightReads, [30, 50, 100, 200, 365, 730]),
    icon: IconMoon,
    color: 'violet',
  },

  /* ── Primera Estrella: capítulos calificados (infinito) ── */
  primeraEstrella: {
    id: 'primeraEstrella',
    label: 'Primera\nEstrella',
    description: 'Califica 10 capítulos para desbloquear',
    unlockCondition: (stats) => (stats.ratings ?? 0) >= 10,
    getLevelInfo: (stats) =>
      getLevelInfo(stats.ratings ?? 0, [10, 50, 120, 500, 1_000, 5_000, 10_000, 50_000], true),
    icon: IconStar,
    color: 'orange',
    infinite: true,
  },
};

/* ============================================================
   StreakFlame - Componente de llama animada
   ============================================================ */
export function StreakFlame({
  streak    = 0,
  compact   = false,
  iconOnly  = false,
  showLabel = true,
}) {
  const { outer, mid, core, glow } = getStreakLevel(streak);

  const W   = iconOnly ? 12 : compact ? 46 : 66;
  const H   = W * 1.5;
  const uid = `sf_${streak}_${compact ? 'c' : 'n'}${iconOnly ? '_i' : ''}`;

  const svg = (
    <svg
      viewBox="0 0 60 90"
      width={W}
      height={H}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        {/* Glow suave */}
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradiente capa exterior */}
        <linearGradient id={`${uid}-g1`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor={outer} stopOpacity="1"   />
          <stop offset="50%"  stopColor={mid}   stopOpacity="0.85" />
          <stop offset="100%" stopColor={mid}   stopOpacity="0.1"  />
        </linearGradient>
        {/* Gradiente capa media */}
        <linearGradient id={`${uid}-g2`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor={outer} stopOpacity="1"   />
          <stop offset="40%"  stopColor={mid}   stopOpacity="0.95" />
          <stop offset="85%"  stopColor={core}  stopOpacity="0.5"  />
          <stop offset="100%" stopColor={core}  stopOpacity="0.1"  />
        </linearGradient>
        {/* Gradiente núcleo */}
        <linearGradient id={`${uid}-g3`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"   />
          <stop offset="30%"  stopColor={core}    stopOpacity="1"   />
          <stop offset="70%"  stopColor={mid}     stopOpacity="0.7" />
          <stop offset="100%" stopColor={mid}     stopOpacity="0"   />
        </linearGradient>
        {/* Glow base */}
        <radialGradient id={`${uid}-gbase`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={outer} stopOpacity="0.8" />
          <stop offset="100%" stopColor={outer} stopOpacity="0"   />
        </radialGradient>
      </defs>

      {/* Resplandor en la base */}
      <ellipse
        cx="30" cy="82" rx="18" ry="8"
        fill={`url(#${uid}-gbase)`}
        filter={`url(#${uid}-glow)`}
        className={styles.glowBase}
      />

      {/* Capa exterior */}
      <path
        d="M31 5
           C28 14, 11 24, 10 43
           C9 58, 15 71, 22 78
           C25 81, 28 83, 30 84
           C32 83, 36 80, 39 76
           C46 68, 51 56, 50 42
           C49 26, 34 14, 31 5 Z"
        fill={`url(#${uid}-g1)`}
        opacity="0.85"
        className={styles.flameOuter}
      />

      {/* Capa media */}
      <path
        d="M30 16
           C28 23, 16 33, 16 47
           C16 59, 20 69, 25 75
           C27 78, 29 80, 30 81
           C31 80, 33 77, 35 74
           C41 67, 44 57, 44 46
           C44 32, 32 23, 30 16 Z"
        fill={`url(#${uid}-g2)`}
        opacity="0.95"
        className={styles.flameMid}
      />

      {/* Lengua izquierda */}
      <path
        d="M24 44
           C22 38, 18 30, 20 22
           C17 30, 15 41, 16 52
           C17 58, 19 64, 22 69
           C23 62, 24 53, 24 44 Z"
        fill={mid}
        opacity="0.5"
        className={styles.flameTongueL}
      />

      {/* Lengua derecha */}
      <path
        d="M36 42
           C38 36, 42 28, 40 20
           C43 28, 45 39, 44 50
           C43 57, 41 63, 38 68
           C37 61, 36 51, 36 42 Z"
        fill={mid}
        opacity="0.45"
        className={styles.flameTongueR}
      />

      {/* Núcleo interno */}
      <path
        d="M30 36
           C28 44, 24 54, 24 63
           C24 71, 27 77, 30 79
           C33 77, 36 71, 36 63
           C36 54, 32 44, 30 36 Z"
        fill={`url(#${uid}-g3)`}
        className={styles.core}
      />

      {/* Highlight blanco */}
      <ellipse
        cx="30" cy="60" rx="5" ry="9"
        fill="#ffffff"
        opacity="0.3"
        className={styles.coreHighlight}
      />

      {/* Chispas */}
      {!iconOnly && SPARKS.map((s, i) => (
        <circle
          key={i}
          cx={s.cx} cy={s.cy}
          r={compact ? 1.2 : 1.7}
          fill={core}
          className={styles.spark}
          style={{ '--dx': s.dx, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
    </svg>
  );

  if (iconOnly) return svg;

  return (
    <div
      className={`${styles.flameContainer} ${compact ? styles.compact : ''}`}
      style={{ '--glow': `rgba(${glow}, 0.55)` }}
    >
      {svg}

      {showLabel && (
        <div className={styles.flameLabel}>
          <span
            className={compact ? styles.numCompact : styles.num}
            style={{
              background:           `linear-gradient(150deg, ${core} 0%, ${mid} 45%, ${outer} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            {fmtStreak(streak)}
          </span>
          <span className={styles.sublabel}>
            Racha
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#facc15" aria-hidden="true" style={{ opacity: 0.88 }}>
              <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 3h10v2H7v-2z" />
            </svg>
          </span>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   AchievementBadge - Insignia individual con soporte multinivel
   ============================================================ */
function AchievementTooltip({ achievement, isUnlocked, level, levelInfo, color }) {
  const AchIcon = achievement.icon;

  if (!isUnlocked) {
    return (
      <Stack gap={6} style={{ maxWidth: 200 }}>
        <Group gap={6} align="center">
          <ThemeIcon size={22} radius="xl" variant="light" color="gray">
            <AchIcon size={12} />
          </ThemeIcon>
          <Text size="sm" fw={700} c="dimmed" style={{ whiteSpace: 'pre-line' }}>
            {achievement.label}
          </Text>
        </Group>
        <Text size="xs" c="dimmed" lh={1.4} style={{ opacity: 0.75 }}>
          {achievement.description}
        </Text>
      </Stack>
    );
  }

  const hasMax = !levelInfo?.nextThreshold;
  const pct = levelInfo && !hasMax
    ? Math.round((levelInfo.currentValue / levelInfo.nextThreshold) * 100)
    : 100;

  return (
    <Stack gap={8} style={{ maxWidth: 210 }}>
      <Group gap={8} align="center">
        <ThemeIcon size={26} radius="xl" variant="light" color={color}>
          <AchIcon size={14} />
        </ThemeIcon>
        <Stack gap={1}>
          <Text size="sm" fw={700} lh={1.2} style={{ whiteSpace: 'pre-line' }}>
            {achievement.label}
          </Text>
          {levelInfo?.name && (
            <Text size="xs" c={`${color}.3`} fw={600}>{levelInfo.name}</Text>
          )}
        </Stack>
      </Group>

      <Box style={{
        background: 'rgba(255,255,255,0.06)',
        borderRadius: rem(8),
        padding: `${rem(6)} ${rem(10)}`,
      }}>
        <Group justify="space-between" mb={5}>
          <Text size="xs" c="dimmed">Nivel {level}</Text>
          {hasMax
            ? <Text size="xs" fw={700} c="yellow">¡Máximo!</Text>
            : <Text size="xs" c="dimmed">{fmtNum(levelInfo.currentValue)} / {fmtNum(levelInfo.nextThreshold)}</Text>
          }
        </Group>
        <Box style={{
          height: 5,
          borderRadius: rem(99),
          background: 'rgba(255,255,255,0.1)',
          overflow: 'hidden',
        }}>
          <Box style={{
            height: '100%',
            width: `${Math.min(pct, 100)}%`,
            borderRadius: rem(99),
            background: `var(--mantine-color-${color}-5)`,
            transition: 'width 0.6s ease',
          }} />
        </Box>
        {!hasMax && (
          <Text size="xs" c="dimmed" mt={4}>→ Nivel {level + 1}</Text>
        )}
      </Box>
    </Stack>
  );
}

function AchievementBadge({ achievement, stats, isDark, isMobile }) {
  const AchIcon = achievement.icon;
  let isUnlocked = false;
  let levelInfo = null;
  try {
    isUnlocked = achievement.unlockCondition(stats);
    levelInfo = achievement.getLevelInfo ? achievement.getLevelInfo(stats) : null;
  } catch (_) {}
  const level = levelInfo?.level ?? 0;
  const color = isUnlocked ? achievement.color : 'gray';

  return (
    <Tooltip
      label={<AchievementTooltip achievement={achievement} isUnlocked={isUnlocked} level={level} levelInfo={levelInfo} color={achievement.color} />}
      withArrow
      position="top"
      multiline
      styles={{
        tooltip: {
          background: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
          backdropFilter: 'blur(12px)',
          borderRadius: rem(12),
          padding: `${rem(10)} ${rem(14)}`,
          color: isDark ? '#e2e8f0' : '#1e293b',
        },
        arrow: {
          background: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        },
      }}
    >
      <Stack
        align="center"
        gap={6}
        style={{
          cursor: 'default',
          padding: rem(isMobile ? 6 : 10),
          borderRadius: rem(12),
          background: isUnlocked
            ? isDark ? `rgba(6,182,212,0.10)` : `rgba(6,182,212,0.07)`
            : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
          border: `1px solid ${isUnlocked
            ? `rgba(6,182,212,0.45)`
            : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          boxShadow: isUnlocked ? `0 0 18px rgba(6,182,212,0.22)` : 'none',
          transition: 'all 0.4s ease',
        }}
      >
        <Box style={{ position: 'relative', opacity: isUnlocked ? 1 : 0.35, filter: isUnlocked ? 'none' : 'grayscale(1)' }}>
          <ThemeIcon size={isMobile ? 40 : 52} radius="xl" variant="light" color={color}>
            <AchIcon size={isMobile ? 20 : 26} />
          </ThemeIcon>

          {isUnlocked && level > 0 && (
            <Badge
              size="xs"
              variant="filled"
              color={achievement.color}
              style={{
                position: 'absolute', bottom: -4, right: -4,
                padding: '0 4px', minWidth: 18, height: 16,
                fontSize: 10, lineHeight: '16px', pointerEvents: 'none',
              }}
            >
              {level}
            </Badge>
          )}
        </Box>

        <Text
          size="xs" ta="center" lh={1.2}
          fw={isUnlocked ? 700 : 400}
          style={{ opacity: isUnlocked ? 1 : 0.5, whiteSpace: 'pre-line' }}
        >
          {achievement.label}
        </Text>
      </Stack>
    </Tooltip>
  );
}

/* ============================================================
   VitrinaLogros - Panel completo de logros
   ============================================================ */
export function VitrinaLogros({ stats = {}, isDark = false, isMobile = false }) {
  const userStats = {
    streak: 0,
    nightReads: 0,
    comments: 0,
    totalChapters: 0,
    maxChaptersPerHour: 0,
    ratings: 0,
    ...stats,
  };

  const achievements = Object.values(ACHIEVEMENT_CATALOG);
  const unlockedCount = achievements.filter(a => a.unlockCondition(userStats)).length;

  return (
    <Paper
      p={isMobile ? 'md' : 'xl'}
      radius="xl"
      h="100%"
      className={`${profileStyles.infoCard} ${isDark ? profileStyles.darkMode : profileStyles.lightMode}`}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      {/* Decoración de fondo */}
      <Box style={{
        position: 'absolute', top: -40, right: -40,
        width: 160, height: 160, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <Stack gap="lg" style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Group justify="space-between" align="center" wrap="nowrap">
          <Group gap="sm">
            <ThemeIcon size="lg" radius="xl" variant="gradient"
              gradient={{ from: 'cyan', to: 'violet', deg: 135 }}
            >
              <IconTrophy size={18} />
            </ThemeIcon>
            <Text fw={700} size={isMobile ? 'md' : 'lg'}>Logros</Text>
          </Group>
          <Badge
            variant="gradient"
            gradient={{ from: 'cyan', to: 'violet' }}
            size="sm"
            leftSection={<IconSparkles size={10} />}
            style={{ padding: '0.4rem 1rem', lineHeight: 1 }}
          >
            {unlockedCount}/∞
          </Badge>
        </Group>

        {/* Grid de logros */}
        <SimpleGrid cols={{ base: 3, sm: 4, md: 6 }} spacing={isMobile ? 'xs' : 'sm'}>
          {achievements.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              stats={userStats}
              isDark={isDark}
              isMobile={isMobile}
            />
          ))}
        </SimpleGrid>

        <Text size="xs" c="dimmed" ta="center" style={{ opacity: 0.6 }}>
          {unlockedCount > 0
            ? `🏆 ${unlockedCount} logro${unlockedCount !== 1 ? 's' : ''} desbloqueado${unlockedCount !== 1 ? 's' : ''}`
            : '¡Comienza a leer para desbloquear logros!'}
        </Text>
      </Stack>
    </Paper>
  );
}
