'use client';

import { useState } from 'react';
import Link from 'next/link';
import { normalizeImageUrl } from '@/utils/imageUtils';
import Header from '@/components/Header';
import {
    IconFlame, IconTrophy, IconCrown, IconMedal, IconStar,
    IconBolt, IconUsers, IconChartBar
} from '@tabler/icons-react';
import classes from './Ranking.module.css';
import { getLocalizedPath } from '@/utils/i18nRoutes';

const LEVEL_COLORS = {
    gray:   '#94a3b8',
    cyan:   '#22d3ee',
    violet: '#a78bfa',
    yellow: '#fbbf24',
};

const LEVEL_BG = {
    gray:   'rgba(148,163,184,0.12)',
    cyan:   'rgba(34,211,238,0.12)',
    violet: 'rgba(167,139,250,0.12)',
    yellow: 'rgba(251,191,36,0.12)',
};

const RANK_COLORS = {
    1: { border: 'rgba(251,191,36,0.5)', glow: 'rgba(251,191,36,0.2)', text: '#fbbf24' },
    2: { border: 'rgba(148,163,184,0.45)', glow: 'rgba(148,163,184,0.12)', text: '#cbd5e1' },
    3: { border: 'rgba(205,127,50,0.45)', glow: 'rgba(205,127,50,0.12)', text: '#cd7f32' },
};

const DEFAULT_AVATAR = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' fill='%231e293b'/%3E%3Ccircle cx='36' cy='28' r='14' fill='%2364748b'/%3E%3Cellipse cx='36' cy='68' rx='22' ry='16' fill='%2364748b'/%3E%3C/svg%3E`

function Avatar({ src, alt, size = 72 }) {
    const [err, setErr] = useState(false);
    const url = (!err && normalizeImageUrl(src)) || DEFAULT_AVATAR;
    return (
        <img
            src={url}
            alt={alt}
            width={size}
            height={size}
            style={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
            onError={() => setErr(true)}
        />
    );
}

function XpBar({ experience, levelColor }) {
    const BREAKPOINTS = [0, 101, 5001, 15001];
    const MAXES       = [100, 4999, 9999, null];
    const levelIdx    = BREAKPOINTS.findLastIndex(b => experience >= b);
    const base        = BREAKPOINTS[levelIdx] ?? 0;
    const max         = MAXES[levelIdx];
    const pct         = max ? Math.min(100, ((experience - base) / (max - base)) * 100) : 100;
    const color       = LEVEL_COLORS[levelColor] || '#94a3b8';
    return (
        <div className={classes.xpBarWrap}>
            <div className={classes.xpBar} style={{ width: `${pct}%`, background: color }} />
        </div>
    );
}

// ─── Podium card (top 3) ────────────────────────────────────────────────────
function PodiumCard({ user, rank, lang, mode }) {
    const rc = RANK_COLORS[rank] || RANK_COLORS[3];
    const levelColor = LEVEL_COLORS[user.levelColor] || '#94a3b8';
    const avatarSize = rank === 1 ? 88 : 72;
    const icon = rank === 1
        ? <IconCrown size={24} />
        : <IconMedal size={20} />;

    return (
        <Link
            href={getLocalizedPath(`/perfil/${user.username}`, lang)}
            className={`${classes.podiumCard} ${classes[`place${rank}`]}`}
            style={{ '--rank-border': rc.border, '--rank-glow': rc.glow, '--rank-text': rc.text }}
        >
            {/* Rank badge */}
            <div className={classes.rankBadge} style={{ color: rc.text }}>
                {icon}
                <span className={classes.rankNum}>#{rank}</span>
            </div>

            {/* Avatar */}
            <div className={classes.avatarRing} style={{ borderColor: rc.border, boxShadow: `0 0 20px ${rc.glow}` }}>
                <Avatar src={user.avatarUrl} alt={user.displayName || user.username} size={avatarSize} />
            </div>

            {/* Name */}
            <span className={classes.pName}>{user.displayName || user.username}</span>

            {/* Level badge */}
            <span
                className={classes.levelBadge}
                style={{ color: levelColor, background: LEVEL_BG[user.levelColor] || LEVEL_BG.gray }}
            >
                {user.levelName || `Nvl. ${user.level}`}
            </span>

            {/* Primary stat */}
            {mode === 'streak' ? (
                <div className={classes.statPill} style={{ borderColor: 'rgba(255,69,0,0.25)', background: 'rgba(255,69,0,0.1)' }}>
                    <IconFlame size={15} style={{ color: '#ff6b35' }} className={classes.flameAnim} />
                    <span className={classes.statBig}>{user.streak}</span>
                    <span className={classes.statUnit}>días</span>
                </div>
            ) : (
                <div className={classes.statPill} style={{ borderColor: `${levelColor}40`, background: LEVEL_BG[user.levelColor] || LEVEL_BG.gray }}>
                    <IconBolt size={15} style={{ color: levelColor }} />
                    <span className={classes.statBig}>{user.experience?.toLocaleString()}</span>
                    <span className={classes.statUnit}>XP</span>
                </div>
            )}

            {/* XP bar (only in xp mode) */}
            {mode === 'xp' && <XpBar experience={user.experience} levelColor={user.levelColor} />}
        </Link>
    );
}

// ─── Row card (rank 4+) ─────────────────────────────────────────────────────
function UserRow({ user, rank, lang, mode }) {
    const levelColor = LEVEL_COLORS[user.levelColor] || '#94a3b8';

    return (
        <Link href={getLocalizedPath(`/perfil/${user.username}`, lang)} className={classes.row}>
            <span className={classes.rowRank}>
                {rank <= 9 ? `0${rank}` : rank}
            </span>

            <div className={classes.rowAvatar}>
                <Avatar src={user.avatarUrl} alt={user.displayName || user.username} size={44} />
            </div>

            <div className={classes.rowInfo}>
                <span className={classes.rowName}>{user.displayName || user.username}</span>
                <div className={classes.rowMeta}>
                    <span style={{ color: levelColor }}>{user.levelName || `Nvl. ${user.level}`}</span>
                    <span className={classes.rowDot}>·</span>
                    <span>{user.experience?.toLocaleString() || 0} XP</span>
                </div>
                {mode === 'xp' && <XpBar experience={user.experience} levelColor={user.levelColor} />}
            </div>

            {mode === 'streak' ? (
                <div className={classes.rowStat}>
                    <IconFlame size={14} className={classes.flameAnim} style={{ color: '#ff6b35' }} />
                    <span className={classes.rowStatNum}>{user.streak}</span>
                </div>
            ) : (
                <div className={classes.rowStat} style={{ borderColor: `${levelColor}35`, background: LEVEL_BG[user.levelColor] || LEVEL_BG.gray }}>
                    <IconBolt size={14} style={{ color: levelColor }} />
                    <span className={classes.rowStatNum} style={{ color: levelColor }}>
                        {(user.experience / 1000).toFixed(1)}k
                    </span>
                </div>
            )}
        </Link>
    );
}

// ─── Principal ──────────────────────────────────────────────────────────────
export default function RankingClient({ topStreak = [], topXp = [], lang = 'es' }) {
    const [mode, setMode] = useState('streak');

    const users   = mode === 'streak' ? topStreak : topXp;
    const podium  = users.slice(0, 3);
    const rest    = users.slice(3);

    // Visual order: [2nd, 1st, 3rd]
    const podiumOrdered = podium.length === 3
        ? [podium[1], podium[0], podium[2]]
        : podium;

    const heroStat1 = mode === 'streak'
        ? { num: topStreak[0]?.streak ?? '—', label: 'Racha más alta' }
        : { num: (topXp[0]?.experience / 1000)?.toFixed(0) + 'k' ?? '—', label: 'XP más alto' };

    return (
        <div className={classes.page}>
            <div className={classes.container}>
                <Header title="Ranking" lang={lang} />

                {/* ── Hero ── */}
                <div className={classes.hero}>
                    <div className={classes.heroGlow} />
                    <div className={classes.heroIconWrap}>
                        <IconTrophy size={40} className={classes.heroIcon} />
                    </div>
                    <h1 className={classes.heroTitle}>Tabla de Honor</h1>
                    <p className={classes.heroSub}>
                        Los lectores más dedicados de la plataforma. ¡Lee cada día para escalar posiciones!
                    </p>
                    <div className={classes.heroStats}>
                        <div className={classes.heroStat}>
                            <IconUsers size={16} className={classes.heroStatIcon} />
                            <span className={classes.heroStatNum}>{users.length}</span>
                            <span className={classes.heroStatLabel}>Lectores</span>
                        </div>
                        <div className={classes.heroStatDivider} />
                        <div className={classes.heroStat}>
                            {mode === 'streak'
                                ? <IconFlame size={16} className={classes.heroStatIcon} style={{ color: '#ff6b35' }} />
                                : <IconBolt size={16} className={classes.heroStatIcon} style={{ color: '#fbbf24' }} />
                            }
                            <span className={classes.heroStatNum}>{heroStat1.num}</span>
                            <span className={classes.heroStatLabel}>{heroStat1.label}</span>
                        </div>
                        {mode === 'streak' && topStreak[0] && (
                            <>
                                <div className={classes.heroStatDivider} />
                                <div className={classes.heroStat}>
                                    <IconStar size={16} className={classes.heroStatIcon} style={{ color: '#a78bfa' }} />
                                    <span className={classes.heroStatNum}>{topStreak[0]?.levelName}</span>
                                    <span className={classes.heroStatLabel}>Rango líder</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className={classes.tabs}>
                    <button
                        className={`${classes.tab} ${mode === 'streak' ? classes.tabActive : ''}`}
                        onClick={() => setMode('streak')}
                    >
                        <IconFlame size={16} />
                        Racha diaria
                    </button>
                    <button
                        className={`${classes.tab} ${mode === 'xp' ? classes.tabActive : ''}`}
                        onClick={() => setMode('xp')}
                    >
                        <IconBolt size={16} />
                        Experiencia
                    </button>
                </div>

                {/* ── Empty ── */}
                {users.length === 0 && (
                    <div className={classes.empty}>
                        <IconFlame size={56} className={classes.emptyFlame} />
                        <h2 className={classes.emptyTitle}>Sin datos aún</h2>
                        <p className={classes.emptyText}>
                            {mode === 'streak'
                                ? 'Aún no hay lectores con rachas activas. ¡Sé el primero en leer hoy!'
                                : 'Sin datos de experiencia todavía.'}
                        </p>
                    </div>
                )}

                {/* ── Podium ── */}
                {podium.length > 0 && (
                    <section className={classes.podiumSection}>
                        <div className={classes.podiumStage}>
                            {podiumOrdered.map((user) => {
                                const rank = users.indexOf(user) + 1;
                                return (
                                    <div key={user.id} className={`${classes.podiumSlot} ${classes[`slot${rank}`]}`}>
                                        <PodiumCard user={user} rank={rank} lang={lang} mode={mode} />
                                        <div className={`${classes.podiumBase} ${classes[`base${rank}`]}`}>
                                            <span className={classes.podiumBaseNum}>{rank}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── List ── */}
                {rest.length > 0 && (
                    <section className={classes.listSection}>
                        <div className={classes.listHeader}>
                            <IconChartBar size={16} className={classes.listIcon} />
                            <span>Clasificación completa</span>
                        </div>
                        <div className={classes.list}>
                            {rest.map((user, i) => (
                                <UserRow key={user.id} user={user} rank={i + 4} lang={lang} mode={mode} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
