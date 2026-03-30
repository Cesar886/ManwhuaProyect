'use client';
import styles from './StreakFlame.module.css';

/*
 * Niveles — solo cambia el color, todo lo demás es igual.
 * outer → mid → core describe el gradiente de la llama (de afuera hacia adentro/arriba).
 */
const LEVELS = [
  { min: 0,  max: 0,
    outer: '#475569', mid: '#94a3b8', core: '#e2e8f0', glow: '71,85,105'   }, // sin racha
  { min: 1,  max: 6,
    outer: '#dc2626', mid: '#f97316', core: '#fef3c7', glow: '249,115,22'  }, // rojo-naranja
  { min: 7,  max: 13,
    outer: '#ea580c', mid: '#f59e0b', core: '#fef9c3', glow: '234,88,12'   }, // naranja-ámbar
  { min: 14, max: 29,
    outer: '#1d4ed8', mid: '#06b6d4', core: '#e0f2fe', glow: '6,182,212'   }, // azul-cyan
  { min: 30, max: 59,
    outer: '#7c3aed', mid: '#ec4899', core: '#fdf4ff', glow: '139,92,246'  }, // violeta-rosa
  { min: 60, max: Infinity,
    outer: '#0e7490', mid: '#8b5cf6', core: '#ecfeff', glow: '14,116,185'  }, // cyan-violeta legendario
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
  { cx: 24, cy: 72, dx: '-11px', delay: '0s',    dur: '1.35s' },
  { cx: 38, cy: 70, dx: '9px',   delay: '0.48s', dur: '1.05s' },
  { cx: 30, cy: 68, dx: '-6px',  delay: '0.92s', dur: '1.55s' },
  { cx: 42, cy: 73, dx: '13px',  delay: '1.28s', dur: '1.15s' },
  { cx: 27, cy: 75, dx: '-15px', delay: '0.28s', dur: '1.8s'  },
];

/**
 * StreakFlame
 * @param {number}  streak
 * @param {boolean} compact   — versión pequeña para mobile
 * @param {boolean} iconOnly  — solo el SVG, sin número/label (para badges inline)
 */
export default function StreakFlame({ streak = 0, compact = false, iconOnly = false }) {
  const { outer, mid, core, glow } = getLevel(streak);

  // Tamaño SVG (viewBox siempre 60×90)
  const W = iconOnly ? 18 : compact ? 46 : 66;
  const H = W * 1.5;

  // El uid evita que múltiples instancias compartan IDs de filtros/gradientes
  const uid = `sf_${streak}_${compact ? 'c' : 'n'}_${iconOnly ? 'i' : ''}`;

  const svg = (
    <svg
      viewBox="0 0 60 90"
      width={W}
      height={H}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        {/* ────────────────────────────────────────────
            FILTRO FUEGO: turbulencia animada + desplazamiento
            Este es el corazón del movimiento orgánico.
        ──────────────────────────────────────────── */}
        <filter id={`${uid}-fire`} x="-45%" y="-35%" width="190%" height="170%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.032 0.092"
            numOctaves="4"
            seed="3"
            result="noise"
          >
            {/* Animación de la frecuencia → movimiento de fuego */}
            <animate
              attributeName="baseFrequency"
              values="0.028 0.082;0.048 0.108;0.033 0.097;0.052 0.112;0.028 0.082"
              dur="2.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.25;0.5;0.75;1"
              keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
            />
          </feTurbulence>
          {/* Desplaza los píxeles de la llama usando el ruido */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale={iconOnly ? 6 : compact ? 11 : 17}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>

        {/* ────────────────────────────────────────────
            FILTRO GLOW: resplandor difuso
        ──────────────────────────────────────────── */}
        <filter id={`${uid}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ────────────────────────────────────────────
            GRADIENTES
            outer → tip: de la base caliente al tip transparente
        ──────────────────────────────────────────── */}

        {/* Llama exterior — color base sólido abajo, desvanece arriba */}
        <linearGradient id={`${uid}-g1`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor={outer} stopOpacity="1"    />
          <stop offset="55%"  stopColor={mid}   stopOpacity="0.75" />
          <stop offset="100%" stopColor={mid}   stopOpacity="0"    />
        </linearGradient>

        {/* Llama media — colores más vivos */}
        <linearGradient id={`${uid}-g2`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor={outer} stopOpacity="1"   />
          <stop offset="45%"  stopColor={mid}   stopOpacity="0.9" />
          <stop offset="100%" stopColor={core}  stopOpacity="0.3" />
        </linearGradient>

        {/* Núcleo — blanco caliente → color → transparente */}
        <linearGradient id={`${uid}-g3`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="25%"  stopColor={core}    stopOpacity="1"    />
          <stop offset="70%"  stopColor={mid}     stopOpacity="0.6"  />
          <stop offset="100%" stopColor={mid}     stopOpacity="0"    />
        </linearGradient>

        {/* Glow base (elipse de luz al pie) */}
        <radialGradient id={`${uid}-gbase`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={outer} stopOpacity="0.9" />
          <stop offset="100%" stopColor={outer} stopOpacity="0"   />
        </radialGradient>
      </defs>

      {/* ── Resplandor base (debajo de todo) ── */}
      <ellipse
        cx="30" cy="80" rx="22" ry="10"
        fill={`url(#${uid}-gbase)`}
        filter={`url(#${uid}-glow)`}
        className={styles.glowBase}
      />

      {/* ── Grupo de llamas con turbulencia ── */}
      <g filter={`url(#${uid}-fire)`} className={styles.flameGroup}>

        {/* Llama exterior — la más ancha */}
        <path
          d="M30 3
             C33 9, 52 24, 54 46
             C56 63, 48 78, 30 85
             C12 78, 4 63, 6 46
             C8 24, 27 9, 30 3 Z"
          fill={`url(#${uid}-g1)`}
          opacity="0.75"
        />

        {/* Llama media */}
        <path
          d="M30 14
             C32 20, 46 33, 47 52
             C48 65, 42 75, 30 80
             C18 75, 12 65, 13 52
             C14 33, 28 20, 30 14 Z"
          fill={`url(#${uid}-g2)`}
          opacity="0.92"
        />
      </g>

      {/* ── Núcleo brillante — mínimo desplazamiento, máx brillo ── */}
      <ellipse
        cx="30" cy="60"
        rx="10" ry="20"
        fill={`url(#${uid}-g3)`}
        className={styles.core}
      />

      {/* ── Chispas (no en modo iconOnly) ── */}
      {!iconOnly && SPARKS.map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={compact ? 1.3 : 1.9}
          fill={core}
          className={styles.spark}
          style={{
            '--dx':            s.dx,
            animationDelay:    s.delay,
            animationDuration: s.dur,
          }}
        />
      ))}
    </svg>
  );

  if (iconOnly) return svg;

  return (
    <div
      className={`${styles.container} ${compact ? styles.compact : ''}`}
      style={{ '--glow': `rgba(${glow}, 0.55)` }}
    >
      {svg}

      <div className={styles.label}>
        <span
          className={compact ? styles.numCompact : styles.num}
          style={{
            background:           `linear-gradient(150deg, ${core} 0%, ${mid} 45%, ${outer} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor:  'transparent',
            backgroundClip:       'text',
          }}
        >
          {fmt(streak)}
        </span>

        <span className={styles.sublabel}>
          Racha
          {/* corona premium */}
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#facc15" aria-hidden="true" style={{ opacity: 0.88 }}>
            <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm2 3h10v2H7v-2z" />
          </svg>
        </span>
      </div>
    </div>
  );
}
