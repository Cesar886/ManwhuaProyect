'use client';
import styles from './StreakFlame.module.css';

const LEVELS = [
  { min: 0,  max: 0,
    base: '#64748b', mid: '#94a3b8', inner: '#cbd5e1', tip: '#e2e8f0', core: '#475569', glow: '100,116,139' },
  { min: 1,  max: 6,
    base: '#b91c1c', mid: '#ea580c', inner: '#fb923c', tip: '#fde68a', core: '#7c3aed', glow: '234,88,12' },
  { min: 7,  max: 13,
    base: '#991b1b', mid: '#dc2626', inner: '#f97316', tip: '#fef08a', core: '#6d28d9', glow: '220,38,38' },
  { min: 14, max: 29,
    base: '#1e3a8a', mid: '#1d4ed8', inner: '#38bdf8', tip: '#e0f2fe', core: '#0369a1', glow: '29,78,216' },
  { min: 30, max: 59,
    base: '#581c87', mid: '#7c3aed', inner: '#e879f9', tip: '#fdf4ff', core: '#4f46e5', glow: '124,58,237' },
  { min: 60, max: Infinity,
    base: '#164e63', mid: '#0891b2', inner: '#818cf8', tip: '#ecfeff', core: '#1e1b4b', glow: '8,145,178' },
];

function getLevel(streak) {
  if (!streak || streak <= 0) return LEVELS[0];
  return LEVELS.slice(1).find(l => streak >= l.min && streak <= l.max) ?? LEVELS[LEVELS.length - 1];
}

function fmt(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

const EMBERS = [
  { cx: 20, cy: 18, dx: '-12px', delay: '0s',    dur: '1.8s', r: 1.5 },
  { cx: 38, cy: 14, dx: '10px',  delay: '0.5s',  dur: '1.5s', r: 1.2 },
  { cx: 26, cy: 10, dx: '-6px',  delay: '1.0s',  dur: '2.0s', r: 1.0 },
  { cx: 42, cy: 20, dx: '14px',  delay: '1.3s',  dur: '1.6s', r: 0.8 },
  { cx: 16, cy: 22, dx: '-16px', delay: '0.3s',  dur: '2.2s', r: 1.3 },
  { cx: 32, cy: 8,  dx: '4px',   delay: '0.7s',  dur: '1.9s', r: 0.9 },
  { cx: 24, cy: 16, dx: '-8px',  delay: '1.5s',  dur: '1.4s', r: 1.1 },
];

export default function StreakFlame({ streak = 0, compact = false, iconOnly = false }) {
  const { base, mid, inner, tip, core, glow } = getLevel(streak);
  const hasStreak = streak > 0;

  const W = iconOnly ? 20 : compact ? 44 : 62;
  const H = W * 1.35;

  const uid = `sf_${streak}_${compact ? 'c' : 'n'}_${iconOnly ? 'i' : ''}`;

  const svg = (
    <svg
      viewBox="0 0 60 84"
      width={W}
      height={H}
      className={styles.flameSvg}
      style={{ overflow: 'visible', display: 'block' }}
      aria-hidden="true"
    >
      <defs>
        {/* Turbulence for organic distortion */}
        <filter id={`${uid}-turb`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.015 0.04"
            numOctaves="3"
            seed="2"
            result="noise"
          >
            <animate attributeName="seed" values="2;5;8;3;2" dur="3s" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>

        {/* Soft glow filter */}
        <filter id={`${uid}-glow`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur1" />
          <feGaussianBlur stdDeviation="2" result="blur2" />
          <feMerge>
            <feMergeNode in="blur1" />
            <feMergeNode in="blur2" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Outer gradient — deep to bright */}
        <linearGradient id={`${uid}-gOuter`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor={base}  stopOpacity="1"   />
          <stop offset="30%"  stopColor={mid}   stopOpacity="0.95"/>
          <stop offset="60%"  stopColor={inner} stopOpacity="0.85"/>
          <stop offset="85%"  stopColor={tip}   stopOpacity="0.5" />
          <stop offset="100%" stopColor={tip}   stopOpacity="0.1" />
        </linearGradient>

        {/* Mid layer gradient */}
        <linearGradient id={`${uid}-gMid`} x1="0.5" y1="1" x2="0.45" y2="0">
          <stop offset="0%"   stopColor={mid}   stopOpacity="0.9" />
          <stop offset="40%"  stopColor={inner} stopOpacity="0.95"/>
          <stop offset="70%"  stopColor={tip}   stopOpacity="0.8" />
          <stop offset="100%" stopColor="#fff"   stopOpacity="0.15"/>
        </linearGradient>

        {/* Inner core gradient — brightest */}
        <linearGradient id={`${uid}-gInner`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%"   stopColor={inner} stopOpacity="1"   />
          <stop offset="50%"  stopColor={tip}   stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.6"/>
        </linearGradient>

        {/* Hot core radial */}
        <radialGradient id={`${uid}-gCore`} cx="50%" cy="65%" r="35%">
          <stop offset="0%"   stopColor={core}  stopOpacity="0.95"/>
          <stop offset="60%"  stopColor={core}  stopOpacity="0.4" />
          <stop offset="100%" stopColor={core}  stopOpacity="0"   />
        </radialGradient>

        {/* Base glow radial */}
        <radialGradient id={`${uid}-gBase`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={mid}   stopOpacity="0.6" />
          <stop offset="100%" stopColor={mid}   stopOpacity="0"   />
        </radialGradient>

        {/* White hot center */}
        <radialGradient id={`${uid}-gWhite`} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.7"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"  />
        </radialGradient>
      </defs>

      {/* Ambient glow under the flame */}
      <ellipse
        cx="30" cy="78" rx="22" ry="8"
        fill={`url(#${uid}-gBase)`}
        filter={`url(#${uid}-glow)`}
        className={styles.glowBase}
      />

      {/* Main flame group with turbulence */}
      <g filter={`url(#${uid}-turb)`}>
        {/* Outer flame — widest, deepest colors */}
        <path
          d="M30 2
             C33 8, 38 14, 44 22
             C52 32, 57 42, 56 52
             C55 64, 46 75, 30 78
             C14 75, 5  64, 4  52
             C3  42, 8  32, 16 22
             C22 14, 27 8, 30 2 Z"
          fill={`url(#${uid}-gOuter)`}
          className={styles.flameOuter}
        />

        {/* Secondary flame tongue — right side flicker */}
        {hasStreak && (
          <path
            d="M34 12
               C38 18, 48 30, 49 44
               C50 56, 42 68, 34 72
               C28 68, 22 60, 22 50
               C22 38, 30 22, 34 12 Z"
            fill={`url(#${uid}-gMid)`}
            opacity="0.6"
            className={styles.flameTongue}
          />
        )}

        {/* Mid flame layer */}
        <path
          d="M30 16
             C33 22, 44 34, 46 48
             C47 60, 40 72, 30 74
             C20 72, 13 60, 14 48
             C16 34, 27 22, 30 16 Z"
          fill={`url(#${uid}-gMid)`}
          className={styles.flameMid}
        />

        {/* Inner bright core */}
        <path
          d="M30 30
             C33 36, 40 44, 40 54
             C40 64, 36 72, 30 73
             C24 72, 20 64, 20 54
             C20 44, 27 36, 30 30 Z"
          fill={`url(#${uid}-gInner)`}
          className={styles.flameInner}
        />
      </g>

      {/* Hot base core — the blue/violet zone */}
      {hasStreak && (
        <ellipse
          cx="30" cy="68" rx="11" ry="8"
          fill={`url(#${uid}-gCore)`}
          className={styles.flameCore}
        />
      )}

      {/* White-hot center point */}
      {hasStreak && (
        <ellipse
          cx="30" cy="64" rx="5" ry="6"
          fill={`url(#${uid}-gWhite)`}
          className={styles.flameWhiteCore}
        />
      )}

      {/* Specular highlights — left */}
      <ellipse
        cx="22" cy="38"
        rx="4" ry="10"
        fill="#ffffff"
        opacity="0.15"
        className={styles.highlight}
        style={{ transform: 'rotate(-18deg)', transformOrigin: '22px 38px' }}
      />

      {/* Specular highlight — right (subtler) */}
      <ellipse
        cx="37" cy="42"
        rx="2.5" ry="7"
        fill="#ffffff"
        opacity="0.08"
        className={styles.highlightRight}
        style={{ transform: 'rotate(12deg)', transformOrigin: '37px 42px' }}
      />

      {/* Embers / sparks */}
      {!iconOnly && EMBERS.map((e, i) => (
        <circle
          key={i}
          cx={e.cx} cy={e.cy}
          r={compact ? e.r * 0.8 : e.r}
          fill={i % 2 === 0 ? tip : inner}
          className={styles.ember}
          style={{
            '--dx': e.dx,
            animationDelay: e.delay,
            animationDuration: e.dur,
          }}
        />
      ))}

      {/* Tiny flickering tip sparks */}
      {!iconOnly && hasStreak && (
        <>
          <circle cx="28" cy="6" r="0.8" fill={tip} className={styles.tipSpark} style={{ animationDelay: '0s' }} />
          <circle cx="32" cy="4" r="0.6" fill="#fff" className={styles.tipSpark} style={{ animationDelay: '0.4s' }} />
          <circle cx="26" cy="8" r="0.5" fill={inner} className={styles.tipSpark} style={{ animationDelay: '0.8s' }} />
        </>
      )}
    </svg>
  );

  if (iconOnly) return svg;

  return (
    <div
      className={`${styles.container} ${compact ? styles.compact : ''}`}
      style={{ '--glow': `rgba(${glow}, 0.5)` }}
    >
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
