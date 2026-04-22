'use client';

import Link from 'next/link';
import { normalizeImageUrl } from '@/utils/imageUtils';
import Header from '@/components/Header';

import { IconFlame, IconTrophy, IconCrown, IconMedal } from '@tabler/icons-react';
import classes from './Ranking.module.css';
import { getLocalizedPath } from '@/utils/i18nRoutes';

// ─── Level color map ───
const LEVEL_COLORS = {
    gray: '#94a3b8',
    cyan: '#22d3ee',
    violet: '#a78bfa',
    yellow: '#fbbf24',
};

// ─── Podium card (top 3) ────────────────────────────────────────────────────
function PodiumCard({ user, rank, lang }) {
    const placeClass = rank === 1 ? classes.first : rank === 2 ? classes.second : classes.third;
    const placeIcon = rank === 1
        ? <IconCrown size={28} className={classes.podiumCrown} />
        : <IconMedal size={22} className={classes.podiumMedal} />;
    const levelColor = LEVEL_COLORS[user.levelColor] || '#94a3b8';

    return (
        <Link href={getLocalizedPath(`/perfil/${user.username}`, lang)} className={`${classes.podiumCard} ${placeClass}`}>
            <div className={classes.podiumRankBadge}>{placeIcon}</div>
            <div className={classes.podiumAvatarRing}>
                <img
                    src={normalizeImageUrl(user.avatarUrl) || '/default-avatar.png'}
                    alt={user.displayName || user.username}
                    className={classes.podiumAvatar}
                />
            </div>
            <h3 className={classes.podiumName}>{user.displayName || user.username}</h3>
            <span className={classes.podiumLevel} style={{ color: levelColor }}>
                {user.levelName || `Nvl. ${user.level}`}
            </span>
            <div className={classes.podiumStreakPill}>
                <IconFlame size={18} className={classes.podiumFlame} />
                <span className={classes.podiumStreakNum}>{user.streak}</span>
                <span className={classes.podiumStreakUnit}>días</span>
            </div>
        </Link>
    );
}

// ─── Row card (rank 4+) ─────────────────────────────────────────────────────
function UserRow({ user, rank, lang }) {
    const levelColor = LEVEL_COLORS[user.levelColor] || '#94a3b8';

    return (
        <Link href={getLocalizedPath(`/perfil/${user.username}`, lang)} className={classes.row}>
            <span className={classes.rowRank}>#{rank}</span>
            <div className={classes.rowAvatarWrap}>
                <img
                    src={normalizeImageUrl(user.avatarUrl) || '/default-avatar.png'}
                    alt={user.displayName || user.username}
                    className={classes.rowAvatar}
                />
            </div>
            <div className={classes.rowInfo}>
                <span className={classes.rowName}>{user.displayName || user.username}</span>
                <span className={classes.rowLevel} style={{ color: levelColor }}>
                    {user.levelName || `Nvl. ${user.level}`} • {user.experience?.toLocaleString() || 0} XP
                </span>
            </div>
            <div className={classes.rowStreak}>
                <IconFlame size={16} className={classes.rowFlame} />
                <span className={classes.rowStreakNum}>{user.streak}</span>
            </div>
        </Link>
    );
}

// ─── Componente Principal ───────────────────────────────────────────────────
export default function RankingClient({ topUsers = [], lang = 'es' }) {
    const podium = topUsers.slice(0, 3);
    const rest = topUsers.slice(3);

    // Reorder podium for visual: [2nd, 1st, 3rd]
    const podiumOrdered = podium.length === 3
        ? [podium[1], podium[0], podium[2]]
        : podium;

    return (
        <div className={classes.page}>
            <div className={classes.container}>
                <Header title="Ranking de Racha" lang={lang} />



                {/* ── Hero ── */}
                <div className={classes.hero}>
                    <div className={classes.heroGlow} />
                    <IconTrophy size={36} className={classes.heroIcon} />
                    <h1 className={classes.heroTitle}>Ranking de Racha</h1>
                    <p className={classes.heroSub}>
                        Los lectores más constantes de la plataforma. ¡Lee cada día para escalar posiciones y mantener tu fuego vivo!
                    </p>
                    <div className={classes.heroStats}>
                        <div className={classes.heroStat}>
                            <span className={classes.heroStatNum}>{topUsers.length}</span>
                            <span className={classes.heroStatLabel}>Lectores activos</span>
                        </div>
                        {topUsers[0] && (
                            <div className={classes.heroStat}>
                                <span className={classes.heroStatNum}>{topUsers[0].streak}</span>
                                <span className={classes.heroStatLabel}>Racha más alta</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Empty ── */}
                {topUsers.length === 0 && (
                    <div className={classes.empty}>
                        <IconFlame size={56} className={classes.emptyFlame} />
                        <h2 className={classes.emptyTitle}>Sin rachas activas</h2>
                        <p className={classes.emptyText}>
                            Aún no hay lectores con rachas en curso. ¡Sé el primero en leer hoy y enciende la llama!
                        </p>
                    </div>
                )}

                {/* ── Podium ── */}
                {podium.length > 0 && (
                    <section className={classes.podiumSection}>
                        <div className={classes.podiumGrid}>
                            {podiumOrdered.map((user) => {
                                const originalRank = topUsers.indexOf(user) + 1;
                                return (
                                    <PodiumCard
                                        key={user.id}
                                        user={user}
                                        rank={originalRank}
                                        lang={lang}
                                    />
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ── List ── */}
                {rest.length > 0 && (
                    <section className={classes.listSection}>
                        <div className={classes.listHeader}>
                            <IconFlame size={18} className={classes.listIcon} />
                            <span>Todos los lectores con racha</span>
                        </div>
                        <div className={classes.list}>
                            {rest.map((user, i) => (
                                <UserRow key={user.id} user={user} rank={i + 4} lang={lang} />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
