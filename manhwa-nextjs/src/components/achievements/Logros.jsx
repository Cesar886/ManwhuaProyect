'use client';

import {
  Paper, Stack, Group, SimpleGrid,
  Box, ThemeIcon, Text, Badge, Tooltip, rem,
} from '@mantine/core';
import {
  IconTrophy, IconSparkles, IconLock,
  IconMoon, IconMessage, IconSword,
  IconBolt, IconCrown, IconDiamond,
} from '@tabler/icons-react';
import profileStyles from '@/app/(es)/user-profile/UserProfile.module.css';
import styles from './Logros.module.css';

/* Nota: StreakFlame está separado en StreakFlame.jsx
   pero se mantiene una copia inline aquí para encapsular toda la lógica de logros */

/* ============================================================
   NIVELES DE RACHA
   Solo cambia el color; la forma y animación son siempre las mismas.
   ============================================================ */
const STREAK_LEVELS = [
  { min: 0,  max: 0,
    outer: '#475569', mid: '#94a3b8', core: '#e2e8f0', glow: '71,85,105'   },
  { min: 1,  max: 6,
    outer: '#dc2626', mid: '#f97316', core: '#fef3c7', glow: '249,115,22'  },
  { min: 7,  max: 13,
    outer: '#ea580c', mid: '#f59e0b', core: '#fef9c3', glow: '234,88,12'   },
  { min: 14, max: 29,
    outer: '#1d4ed8', mid: '#06b6d4', core: '#e0f2fe', glow: '6,182,212'   },
  { min: 30, max: 59,
    outer: '#7c3aed', mid: '#ec4899', core: '#fdf4ff', glow: '139,92,246'  },
  { min: 60, max: Infinity,
    outer: '#0e7490', mid: '#8b5cf6', core: '#ecfeff', glow: '14,116,185'  },
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

/* Posiciones y timings de las chispas */
const SPARKS = [
  { cx: 24, cy: 72, dx: '-11px', delay: '0s',    dur: '1.35s' },
  { cx: 38, cy: 70, dx: '9px',   delay: '0.48s', dur: '1.05s' },
  { cx: 30, cy: 68, dx: '-6px',  delay: '0.92s', dur: '1.55s' },
  { cx: 42, cy: 73, dx: '13px',  delay: '1.28s', dur: '1.15s' },
  { cx: 27, cy: 75, dx: '-15px', delay: '0.28s', dur: '1.8s'  },
];

/* ============================================================
   StreakFlame
   Llama SVG animada con niveles de color por días de racha.

   Props:
   - streak     {number}  — días de racha actuales
   - compact    {boolean} — versión reducida para layouts compactos
   - iconOnly   {boolean} — solo el SVG, sin número ni label (para badges)
   - showLabel  {boolean} — mostrar/ocultar el número y la label "Racha"
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
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <linearGradient id={`${uid}-g1`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor={outer} stopOpacity="1"   />
          <stop offset="50%"  stopColor={mid}   stopOpacity="0.85" />
          <stop offset="100%" stopColor={mid}   stopOpacity="0.1"  />
        </linearGradient>
        <linearGradient id={`${uid}-g2`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor={outer} stopOpacity="1"   />
          <stop offset="40%"  stopColor={mid}   stopOpacity="0.95" />
          <stop offset="85%"  stopColor={core}  stopOpacity="0.5"  />
          <stop offset="100%" stopColor={core}  stopOpacity="0.1"  />
        </linearGradient>
        <linearGradient id={`${uid}-g3`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="1"   />
          <stop offset="30%"  stopColor={core}    stopOpacity="1"   />
          <stop offset="70%"  stopColor={mid}     stopOpacity="0.7" />
          <stop offset="100%" stopColor={mid}     stopOpacity="0"   />
        </linearGradient>
        <radialGradient id={`${uid}-gbase`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={outer} stopOpacity="0.8" />
          <stop offset="100%" stopColor={outer} stopOpacity="0"   />
        </radialGradient>
      </defs>

      <ellipse
        cx="30" cy="82" rx="18" ry="8"
        fill={`url(#${uid}-gbase)`}
        filter={`url(#${uid}-glow)`}
        className={styles.glowBase}
      />

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

      <path
        d="M30 36
           C28 44, 24 54, 24 63
           C24 71, 27 77, 30 79
           C33 77, 36 71, 36 63
           C36 54, 32 44, 30 36 Z"
        fill={`url(#${uid}-g3)`}
        className={styles.core}
      />

      <ellipse
        cx="30" cy="60" rx="5" ry="9"
        fill="#ffffff"
        opacity="0.3"
        className={styles.coreHighlight}
      />

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
   CATÁLOGO DE INSIGNIAS BLOQUEADAS
   Aquí se definen todas las insignias futuras.
   ============================================================ */
const LOCKED_BADGES = [
  { label: 'Lector\nNocturno', icon: IconMoon,    color: 'violet', desc: 'Lee de madrugada'  },
  { label: 'Crítico',          icon: IconMessage,  color: 'cyan',   desc: '10 comentarios'    },
  { label: 'Devorador',        icon: IconSword,    color: 'orange', desc: '100 capítulos'     },
  { label: 'Veloz',            icon: IconBolt,     color: 'yellow', desc: 'Lee 5 caps en 1h'  },
  { label: 'Guardián',         icon: IconCrown,    color: 'teal',   desc: '500 capítulos'     },
  { label: 'Diamante',         icon: IconDiamond,  color: 'blue',   desc: '1000 capítulos'    },
];

/* ============================================================
   VitrinaLogros
   Panel "Vitrina de Insignias" completo.

   Props:
   - streak   {number}  — racha actual del usuario
   - isDark   {boolean} — tema oscuro/claro
   - isMobile {boolean} — viewport móvil
   ============================================================ */
export function VitrinaLogros({ streak = 0, isDark = false, isMobile = false }) {
  const streakGlowRgb =
    !streak || streak <= 0 ? null
    : streak < 7            ? '249,115,22'
    : streak < 14           ? '245,158,11'
    : streak < 30           ? '59,130,246'
    : streak < 60           ? '139,92,246'
    :                         '6,182,212';

  const streakUnlocked = streak > 0;

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
            <Text fw={700} size={isMobile ? 'md' : 'lg'}>Vitrina de Insignias</Text>
          </Group>
          <Badge
            variant="gradient"
            gradient={{ from: 'cyan', to: 'violet' }}
            size="sm"
            leftSection={<IconSparkles size={10} />}
          >
            Próximamente
          </Badge>
        </Group>

        {/* Grid de insignias */}
        <SimpleGrid cols={{ base: 3, sm: 4, md: 7 }} spacing={isMobile ? 'xs' : 'sm'}>

          {/* ── Insignia de Racha (única activa) ── */}
          <Tooltip
            label={
              streakUnlocked
                ? `🔥 Racha de ${streak} día${streak !== 1 ? 's' : ''}`
                : '¡Lee hoy para iniciar tu racha!'
            }
            withArrow
            position="top"
          >
            <Stack
              align="center"
              gap={6}
              style={{
                cursor: 'default',
                padding: rem(isMobile ? 6 : 10),
                borderRadius: rem(12),
                background: streakUnlocked
                  ? isDark
                    ? `rgba(${streakGlowRgb},0.10)`
                    : `rgba(${streakGlowRgb},0.07)`
                  : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${
                  streakUnlocked
                    ? `rgba(${streakGlowRgb},0.45)`
                    : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                }`,
                boxShadow: streakUnlocked
                  ? `0 0 18px rgba(${streakGlowRgb},0.22)`
                  : 'none',
                transition: 'all 0.4s ease',
              }}
            >
              <Box style={{
                position: 'relative',
                opacity: streakUnlocked ? 1 : 0.35,
                filter:  streakUnlocked ? 'none' : 'grayscale(1)',
              }}>
                <StreakFlame streak={streak} compact showLabel={false} />
                {!streakUnlocked && (
                  <ThemeIcon
                    size={18} radius="xl" variant="filled"
                    style={{
                      position: 'absolute', bottom: -3, right: -3,
                      opacity: 0.6,
                      background: isDark
                        ? 'rgba(15,23,42,0.9)'
                        : 'rgba(100,100,100,0.8)',
                    }}
                  >
                    <IconLock size={10} />
                  </ThemeIcon>
                )}
              </Box>
              <Text
                size="xs" ta="center" lh={1.2}
                fw={streakUnlocked ? 700 : 400}
                style={{
                  opacity: streakUnlocked ? 1 : 0.5,
                  color:   streakUnlocked ? `rgb(${streakGlowRgb})` : undefined,
                }}
              >
                Racha
              </Text>
            </Stack>
          </Tooltip>

          {/* ── Insignias bloqueadas ── */}
          {LOCKED_BADGES.map((badge) => {
            const BadgeIcon = badge.icon;
            return (
              <Tooltip key={badge.label} label={badge.desc} withArrow position="top">
                <Stack
                  align="center"
                  gap={6}
                  style={{
                    cursor: 'default',
                    padding: rem(isMobile ? 6 : 10),
                    borderRadius: rem(12),
                    background: isDark
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${
                      isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                    }`,
                  }}
                >
                  <Box style={{ position: 'relative' }}>
                    <ThemeIcon
                      size={isMobile ? 40 : 52}
                      radius="xl"
                      variant="light"
                      color="gray"
                      style={{ opacity: 0.3, filter: 'grayscale(1)' }}
                    >
                      <BadgeIcon size={isMobile ? 20 : 26} />
                    </ThemeIcon>
                    <ThemeIcon
                      size={18} radius="xl" color="dark" variant="filled"
                      style={{
                        position: 'absolute', bottom: -3, right: -3,
                        opacity: 0.6,
                        background: isDark
                          ? 'rgba(15,23,42,0.9)'
                          : 'rgba(100,100,100,0.8)',
                      }}
                    >
                      <IconLock size={10} />
                    </ThemeIcon>
                  </Box>
                  <Text
                    size="xs" c="dimmed" ta="center" lh={1.2}
                    style={{ opacity: 0.5, whiteSpace: 'pre-line' }}
                  >
                    {badge.label}
                  </Text>
                </Stack>
              </Tooltip>
            );
          })}
        </SimpleGrid>

        <Text size="xs" c="dimmed" ta="center" style={{ opacity: 0.6 }}>
          {streak > 0
            ? '🔥 Insignia de Racha desbloqueada — ¡sigue leyendo cada día!'
            : 'Mantén una racha de lectura para desbloquear la primera insignia'}
        </Text>
      </Stack>
    </Paper>
  );
}
