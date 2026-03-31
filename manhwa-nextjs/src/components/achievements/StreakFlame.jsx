'use client';
import styles from './StreakFlame.module.css';

/*
 * Niveles de color — inspirados en TikTok: naranja cálido por defecto,
 * colores premium para rachas largas.
 */
const LEVELS = [
  { min: 0,  max: 0,
    base: '#64748b', inner: '#94a3b8', tip: '#e2e8f0', blue: '#475569', glow: '100,116,139' },
  { min: 1,  max: 6,
    base: '#ea580c', inner: '#fb923c', tip: '#fde68a', blue: '#7c3aed', glow: '234,88,12'   },
  { min: 7,  max: 13,
    base: '#dc2626', inner: '#f97316', tip: '#fef08a', blue: '#6d28d9', glow: '220,38,38'   },
  { min: 14, max: 29,
    base: '#1d4ed8', inner: '#38bdf8', tip: '#e0f2fe', blue: '#0369a1', glow: '29,78,216'   },
  { min: 30, max: 59,
    base: '#7c3aed', inner: '#e879f9', tip: '#fdf4ff', blue: '#4f46e5', glow: '124,58,237'  },
  { min: 60, max: Infinity,
    base: '#0891b2', inner: '#818cf8', tip: '#ecfeff', blue: '#1e1b4b', glow: '8,145,178'   },
];

function getLevel(streak) {
  if (!streak || streak <= 0) return LEVELS[0];
  return LEVELS.slice(1).find(l => streak >= l.min && streak <= l.max) ?? LEVELS[LEVELS.length - 1];
}

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

const SPARKS = [
  { cx: 22, cy: 14, dx: '-10px', delay: '0s',    dur: '1.2s'  },
  { cx: 36, cy: 12, dx:  '8px',  delay: '0.45s', dur: '1.0s'  },
  { cx: 28, cy: 10, dx: '-5px',  delay: '0.85s', dur: '1.4s'  },
  { cx: 40, cy: 16, dx: '12px',  delay: '1.2s',  dur: '1.1s'  },
  { cx: 18, cy: 18, dx: '-14px', delay: '0.3s',  dur: '1.6s'  },
];

/**
 * StreakFlame — inspirado en el diseño de TikTok 🔥
 * @param {number}  streak
 * @param {boolean} compact   — versión pequeña para mobile
 * @param {boolean} iconOnly  — solo el SVG sin número/label (para badges inline)
 */
export default function StreakFlame({ streak = 0, compact = false, iconOnly = false }) {
  const { base, inner, tip, blue, glow } = getLevel(streak);
  const hasStreak = streak > 0;

  const W = iconOnly ? 20 : compact ? 44 : 62;
  const H = W * 1.35;

  const uid = `sf_${streak}_${compact ? 'c' : 'n'}_${iconOnly ? 'i' : ''}`;

  const svg = (
    <svg
      viewBox="0 0 60 81"
      width={W}
      height={H}
      className={styles.flameSvg}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        {/* Filtro glow */}
        <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Gradiente exterior — de base oscuro a mid cálido */}
        <linearGradient id={`${uid}-gOuter`} x1="0.4" y1="1" x2="0.6" y2="0">
          <stop offset="0%"   stopColor={base}  stopOpacity="1"   />
          <stop offset="55%"  stopColor={base}  stopOpacity="0.9" />
          <stop offset="100%" stopColor={inner} stopOpacity="0.3" />
        </linearGradient>

        {/* Gradiente interior — brillante */}
        <linearGradient id={`${uid}-gInner`} x1="0.5" y1="1" x2="0.45" y2="0">
          <stop offset="0%"   stopColor={inner} stopOpacity="1"   />
          <stop offset="50%"  stopColor={tip}   stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
        </linearGradient>

        {/* Gradiente base azul/violeta (parte más caliente) */}
        <radialGradient id={`${uid}-gBlue`} cx="50%" cy="60%" r="50%">
          <stop offset="0%"   stopColor={blue}  stopOpacity="0.9" />
          <stop offset="100%" stopColor={blue}  stopOpacity="0"   />
        </radialGradient>

        {/* Glow radial base */}
        <radialGradient id={`${uid}-gBase`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={base}  stopOpacity="0.7" />
          <stop offset="100%" stopColor={base}  stopOpacity="0"   />
        </radialGradient>
      </defs>

      {/* Resplandor en la base */}
      <ellipse
        cx="30" cy="76" rx="20" ry="7"
        fill={`url(#${uid}-gBase)`}
        filter={`url(#${uid}-glow)`}
        className={styles.glowBase}
      />

      {/* ── Cuerpo principal — emoji-like teardrop ── */}
      {/* Forma redondeada, ancha, como 🔥 */}
      <path
        d="M30 4
           C35 13, 55 25, 55 46
           C55 62, 45 74, 30 76
           C15 74, 5  62, 5  46
           C5  25, 25 13, 30 4 Z"
        fill={`url(#${uid}-gOuter)`}
        className={styles.flameBody}
      />

      {/* ── Núcleo brillante interior ── */}
      <path
        d="M30 22
           C34 30, 46 40, 46 53
           C46 63, 39 71, 30 72
           C21 71, 14 63, 14 53
           C14 40, 26 30, 30 22 Z"
        fill={`url(#${uid}-gInner)`}
        className={styles.flameInner}
      />

      {/* ── Base azul/violeta (parte más caliente, como la base de una vela) ── */}
      {hasStreak && (
        <path
          d="M30 58
             C23 58, 17 63, 17 68
             C17 73, 23 76, 30 76
             C37 76, 43 73, 43 68
             C43 63, 37 58, 30 58 Z"
          fill={`url(#${uid}-gBlue)`}
          className={styles.flameBlue}
        />
      )}

      {/* ── Highlight blanco — punto caliente superior izquierdo (como el emoji) ── */}
      <ellipse
        cx="22" cy="36"
        rx="5" ry="8"
        fill="#ffffff"
        opacity="0.22"
        className={styles.highlight}
        style={{ transform: 'rotate(-15deg)', transformOrigin: '22px 36px' }}
      />

      {/* ── Chispas flotantes ── */}
      {!iconOnly && SPARKS.map((s, i) => (
        <circle
          key={i}
          cx={s.cx} cy={s.cy}
          r={compact ? 1.3 : 1.8}
          fill={tip}
          className={styles.spark}
          style={{ '--dx': s.dx, animationDelay: s.delay, animationDuration: s.dur }}
        />
      ))}
    </svg>
  );

  if (iconOnly) return svg;

  return (
    <div
      className={`${styles.container} ${compact ? styles.compact : ''}`}
      style={{ '--glow': `rgba(${glow}, 0.5)` }}
    >
      {/* Layout horizontal tipo TikTok: 🔥 + número + label */}
      <div className={styles.row}>
        {svg}
        <div className={styles.label}>
          <span
            className={compact ? styles.numCompact : styles.num}
            style={{
              background:           `linear-gradient(135deg, ${tip} 0%, ${inner} 40%, ${base} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            {fmt(streak)}
          </span>
          <span className={styles.sublabel}>días</span>
        </div>
      </div>
    </div>
  );
}
