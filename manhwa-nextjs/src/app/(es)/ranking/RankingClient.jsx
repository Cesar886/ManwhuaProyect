'use client';

import { useState } from 'react';
import Link from 'next/link';
import { normalizeImageUrl } from '@/utils/imageUtils';
import Header from '@/components/Header';
import {
    IconArrowUpRight, IconBolt, IconChevronRight, IconCrown,
    IconFlame, IconMedal, IconTrophy, IconUsers,
} from '@tabler/icons-react';
import { getLocalizedPath } from '@/utils/i18nRoutes';
import classes from './Ranking.module.css';

const LEVEL_COLORS = {
    gray: '#64748b',
    cyan: '#0891b2',
    violet: '#8b5cf6',
    yellow: '#b7791f',
};

const DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 72 72'%3E%3Crect width='72' height='72' fill='%23272b3b'/%3E%3Ccircle cx='36' cy='28' r='14' fill='%238c91a7'/%3E%3Cellipse cx='36' cy='68' rx='22' ry='16' fill='%238c91a7'/%3E%3C/svg%3E";

function Avatar({ src, alt, size }) {
    const [error, setError] = useState(false);
    const url = (!error && normalizeImageUrl(src)) || DEFAULT_AVATAR;

    return (
        <img
            src={url}
            alt={alt}
            width={size}
            height={size}
            className={classes.avatarImage}
            onError={() => setError(true)}
        />
    );
}

function XpBar({ experience = 0, levelColor }) {
    const breakpoints = [0, 101, 5001, 15001];
    const maxes = [100, 5000, 15000, null];
    const levelIndex = Math.max(0, breakpoints.findLastIndex(point => experience >= point));
    const base = breakpoints[levelIndex];
    const max = maxes[levelIndex];
    const progress = max ? Math.max(0, Math.min(100, ((experience - base) / (max - base)) * 100)) : 100;

    return (
        <div className={classes.xpTrack} aria-label={Math.round(progress) + '% de progreso al siguiente nivel'}>
            <span className={classes.xpProgress} style={{ width: progress + '%', backgroundColor: LEVEL_COLORS[levelColor] || LEVEL_COLORS.gray }} />
        </div>
    );
}

function PodiumCard({ user, rank, lang, mode }) {
    const name = user.displayName || user.username;
    const isStreak = mode === 'streak';
    const value = isStreak ? (user.streak || 0) : (user.experience || 0);

    return (
        <Link
            href={getLocalizedPath('/users/' + user.username, lang)}
            className={classes.podiumCard + ' ' + classes['place' + rank]}
            aria-label={'Puesto ' + rank + ': ' + name + ', ' + value.toLocaleString('es-MX') + (isStreak ? (value === 1 ? ' día de racha' : ' días de racha') : ' puntos de experiencia')}
        >
            <div className={classes.cardTopline}>
                <span className={classes.placement}>{'#' + String(rank).padStart(2, '0')}</span>
                {rank === 1 ? <IconCrown size={21} stroke={1.8} /> : <IconMedal size={21} stroke={1.8} />}
            </div>

            <div className={classes.podiumAvatar}>
                <Avatar src={user.avatarUrl} alt="" size={rank === 1 ? 84 : 76} />
            </div>

            <div className={classes.podiumIdentity}>
                <span className={classes.podiumName} title={name}>{name}</span>
                <span className={classes.levelLabel}>{user.levelName || 'Nivel ' + (user.level || 0)}</span>
            </div>

            <div className={classes.podiumMetric}>
                {isStreak ? <IconFlame size={19} stroke={1.8} /> : <IconBolt size={19} stroke={1.8} />}
                <strong>{value.toLocaleString('es-MX')}</strong>
                <span>{isStreak ? (value === 1 ? 'día de racha' : 'días de racha') : 'XP'}</span>
            </div>
            {!isStreak && <XpBar experience={value} levelColor={user.levelColor} />}
            <span className={classes.cardLink}>Ver perfil <IconArrowUpRight size={14} /></span>
        </Link>
    );
}

function UserRow({ user, rank, lang, mode }) {
    const name = user.displayName || user.username;
    const isStreak = mode === 'streak';
    const value = isStreak ? (user.streak || 0) : (user.experience || 0);

    return (
        <Link href={getLocalizedPath('/users/' + user.username, lang)} className={classes.row}>
            <span className={classes.rowRank}>{String(rank).padStart(2, '0')}</span>
            <span className={classes.rowAvatar}><Avatar src={user.avatarUrl} alt="" size={46} /></span>
            <span className={classes.rowIdentity}>
                <strong className={classes.rowName}>{name}</strong>
                <span className={classes.rowLevel}>{user.levelName || 'Nivel ' + (user.level || 0)}</span>
            </span>
            <span className={classes.rowXp}>{(user.experience || 0).toLocaleString('es-MX')} XP</span>
            <span className={classes.rowMetric}>
                {isStreak ? <IconFlame size={17} /> : <IconBolt size={17} />}
                <strong>{value.toLocaleString('es-MX')}</strong>
                <small>{isStreak ? (value === 1 ? 'día' : 'días') : 'XP'}</small>
            </span>
            <IconChevronRight className={classes.rowArrow} size={18} />
        </Link>
    );
}

export default function RankingClient({ topStreak = [], topXp = [], lang = 'es' }) {
    const [mode, setMode] = useState('streak');
    const users = mode === 'streak' ? topStreak : topXp;
    const podium = users.slice(0, 3);
    const rest = users.slice(3);
    const leader = users[0];
    const isStreak = mode === 'streak';
    const leaderValue = leader ? (isStreak ? leader.streak || 0 : leader.experience || 0) : null;

    return (
        <div className={classes.page}>
            <Header title="Ranking" lang={lang} />
            <main className={classes.container}>
                <section className={classes.hero} aria-labelledby="ranking-title">
                    <div className={classes.heroCopy}>
                        <span className={classes.eyebrow}><IconTrophy size={15} /> Comunidad Manhwa Imperial</span>
                        <h1 id="ranking-title">Los lectores que <em>marcan el ritmo.</em></h1>
                        <p>Descubre a quienes más leen y suman experiencia. Cada día es una oportunidad para subir en la clasificación.</p>
                        <div className={classes.heroMeta}>
                            <span><IconUsers size={16} /> {users.length} {users.length === 1 ? 'lector destacado' : 'lectores destacados'}</span>
                            <span className={classes.metaDivider} />
                            <span>Clasificación de la comunidad</span>
                        </div>
                    </div>
                    <div className={classes.heroFeature} aria-label="Mejor resultado actual">
                        <div className={classes.featureIcon}>{isStreak ? <IconFlame size={30} /> : <IconBolt size={30} />}</div>
                        <span className={classes.featureLabel}>{isStreak ? 'Racha más alta' : 'Experiencia más alta'}</span>
                        <strong className={classes.featureValue}>{leaderValue === null ? '—' : leaderValue.toLocaleString('es-MX')}</strong>
                        <span className={classes.featureUnit}>{isStreak ? (leaderValue === 1 ? 'día consecutivo' : 'días consecutivos') : 'puntos de experiencia'}</span>
                        <span className={classes.featureLeader}>{leader ? 'Líder: ' + (leader.displayName || leader.username) : 'Aún no hay líderes'}</span>
                    </div>
                </section>

                <section className={classes.rankingSection} aria-labelledby="classification-title">
                    <div className={classes.sectionHeader}>
                        <div>
                            <span className={classes.sectionKicker}>TABLA DE HONOR</span>
                            <h2 id="classification-title">Clasificación de lectores</h2>
                            <p>Explora los puestos por constancia o experiencia acumulada.</p>
                        </div>
                        <div className={classes.tabs} role="group" aria-label="Tipo de clasificación">
                            <button type="button" className={classes.tab + ' ' + (isStreak ? classes.tabActive : '')} aria-pressed={isStreak} onClick={() => setMode('streak')}>
                                <IconFlame size={18} /> Racha diaria
                            </button>
                            <button type="button" className={classes.tab + ' ' + (!isStreak ? classes.tabActive : '')} aria-pressed={!isStreak} onClick={() => setMode('xp')}>
                                <IconBolt size={18} /> Experiencia
                            </button>
                        </div>
                    </div>

                    {users.length === 0 ? (
                        <div className={classes.empty}>
                            <span className={classes.emptyIcon}>{isStreak ? <IconFlame size={30} /> : <IconBolt size={30} />}</span>
                            <h3>Aún no hay lectores en esta clasificación</h3>
                            <p>{isStreak ? 'Lee hoy y comienza tu racha para aparecer aquí.' : 'Sigue leyendo para acumular experiencia y entrar al ranking.'}</p>
                        </div>
                    ) : (
                        <>
                            <div className={classes.podiumStage} aria-label="Primeros puestos">
                                {podium.map((user, index) => (
                                    <div key={user.id || user.username} className={classes.podiumSlot + ' ' + classes['slot' + (index + 1)]}>
                                        <PodiumCard user={user} rank={index + 1} lang={lang} mode={mode} />
                                    </div>
                                ))}
                            </div>

                            {rest.length > 0 && (
                                <div className={classes.listSection}>
                                    <div className={classes.listTitle}>
                                        <h3>Más lectores destacados</h3>
                                        <span>{'Puestos 04—' + String(users.length).padStart(2, '0')}</span>
                                    </div>
                                    <div className={classes.listHead} aria-hidden="true">
                                        <span>Puesto</span><span /><span>Lector</span><span>Experiencia</span><span>{isStreak ? 'Racha' : 'Total'}</span><span />
                                    </div>
                                    <div className={classes.list}>
                                        {rest.map((user, index) => (
                                            <UserRow key={user.id || user.username} user={user} rank={index + 4} lang={lang} mode={mode} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </section>
            </main>
        </div>
    );
}
