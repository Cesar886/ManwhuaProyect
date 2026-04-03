'use client';

import Link from 'next/link';
import { useRef, useCallback } from 'react';
import { normalizeImageUrl } from '../../utils/imageUtils';
import ManhwaCover from '../../components/ManhwaCover';
import Header from '@/components/Header';
import {
    IconTrophy, IconFlame, IconStar, IconEye,
    IconCalendar, IconSparkles, IconClock,
    IconChevronLeft, IconChevronRight, IconArrowRight,
} from '@tabler/icons-react';
import classes from './Populares.module.css';
import AdsterraBannerDisplay from '@/components/AdsterraBannerDisplay';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatViews(n) {
    if (!n || n <= 0) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
    return String(n);
}

// ─── Card unificada ──────────────────────────────────────────────────────────

function PopularCard({ item, index, priority = false, showRank = false, showViews = false }) {
    const rankClass = showRank
        ? index === 0
            ? classes.rankGold
            : index === 1
                ? classes.rankSilver
                : index === 2
                    ? classes.rankBronze
                    : ''
        : '';

    const viewsLabel = showViews ? formatViews(item.views) : null;

    return (
        <Link
            href={`/manhwa/${item.slug}`}
            className={classes.cardItem}
            title={`Leer ${item.title} en español`}
        >
            <div className={classes.card}>
                <ManhwaCover
                    src={normalizeImageUrl(item.cover || item.coverUrl || item.cover_url || item.coverUrlWeb || item.cover_url_web) || ''}
                    fallbackSrc={normalizeImageUrl(item.coverUrlWeb || item.cover_url_web || item.cover || item.coverUrl || item.cover_url) || ''}
                    slug={item.slug}
                    alt={`Portada del manhwa ${item.title}`}
                    className={classes.cardImg}
                    priority={priority}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 160px"
                />

                {/* Indicadores HOT / NUEVO / TRENDING — top row */}
                {(item.isHot || item.isNew || item.isTrending) && (
                    <div className={classes.flagRow}>
                        {item.isHot && <span className={classes.flagHot}>🔥</span>}
                        {item.isTrending && <span className={classes.flagTrending}>↑</span>}
                        {item.isNew && <span className={classes.flagNew}>NUEVO</span>}
                    </div>
                )}

                {/* Badge capítulos — top left */}
                {item.chapters > 0 && (
                    <span className={classes.chapterBadge}>
                        {item.chapters} caps
                    </span>
                )}

                {/* Badge tipo — top right */}
                <span className={classes.statusBadge}>
                    {item.contentType || 'Manhwa'}
                </span>

                {/* Rank overlay — bottom left (solo Top Ranking) */}
                {showRank && (
                    <span className={`${classes.rankBadge} ${rankClass}`}>
                        #{item.rank}
                    </span>
                )}

                {/* Views — bottom left cuando no hay rank */}
                {!showRank && viewsLabel && (
                    <span className={classes.viewsBadge}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z" />
                        </svg>
                        {viewsLabel}
                    </span>
                )}

                {/* Rating — bottom right */}
                {item.rating > 0 && (
                    <span className={classes.ratingBadge}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {Math.min(item.rating, 5).toFixed(1)}
                    </span>
                )}

                {/* Título overlay con gradiente */}
                <h3 className={classes.cardTitle}>{item.title}</h3>
            </div>
        </Link>
    );
}

// ─── Section Row (header + scroll horizontal) ───────────────────────────────

function SectionRow({ title, icon: Icon, subtitle, items, renderCard, verTodoHref }) {
    const scrollRef = useRef(null);

    const scrollBy = useCallback((dir) => {
        if (!scrollRef.current) return;
        const amount = scrollRef.current.clientWidth * 0.75;
        scrollRef.current.scrollBy({ left: dir * amount, behavior: 'smooth' });
    }, []);

    if (!items || items.length === 0) return null;

    return (
        <section className={classes.sectionBlock}>
            <div className={classes.sectionHeader}>
                <div className={classes.sectionIcon}>
                    <Icon size={22} stroke={1.8} />
                </div>
                <div className={classes.sectionTitleGroup}>
                    <h2 className={classes.sectionTitle}>{title}</h2>
                    {subtitle && <p className={classes.sectionSubtitle}>{subtitle}</p>}
                </div>
                <div className={classes.sectionActions}>
                    <button
                        className={classes.scrollBtn}
                        onClick={() => scrollBy(-1)}
                        aria-label="Desplazar a la izquierda"
                        type="button"
                    >
                        <IconChevronLeft size={16} stroke={2} />
                    </button>
                    <button
                        className={classes.scrollBtn}
                        onClick={() => scrollBy(1)}
                        aria-label="Desplazar a la derecha"
                        type="button"
                    >
                        <IconChevronRight size={16} stroke={2} />
                    </button>
                    {verTodoHref && (
                        <Link href={verTodoHref} className={classes.verTodoLink}>
                            Ver todo <IconArrowRight size={13} stroke={2} />
                        </Link>
                    )}
                </div>
            </div>
            <div className={classes.cardsScroll} ref={scrollRef}>
                {items.map((item, i) => renderCard(item, i))}
            </div>
        </section>
    );
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function PopularesClient({
    topRankings = [],
    trending = [],
    topRated = [],
    weeklyPopular = [],
    monthlyPopular = [],
    newReleases = [],
    latestUpdates = [],
}) {
    const hasData = topRankings.length || trending.length || topRated.length
        || weeklyPopular.length || monthlyPopular.length
        || newReleases.length || latestUpdates.length;

    if (!hasData) {
        return (
            <div className={classes.page}>
                <div className={classes.container}>
                    <Header title="Populares" />
                    <div className={classes.empty}>
                        <svg className={classes.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path d="M9 10h.01M15 10h.01M8 14s1.5 2 4 2 4-2 4-2" />
                        </svg>
                        <h2 className={classes.emptyTitle}>Sin datos de popularidad aún</h2>
                        <p className={classes.emptyText}>
                            Los rankings se generan a partir de las vistas y valoraciones de la comunidad.
                            ¡Vuelve pronto para ver las tendencias!
                        </p>
                        <Link href="/biblioteca" className={classes.emptyLink}>
                            Explorar Biblioteca
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={classes.page}>
            <div className={classes.container}>
                <Header title="Populares" />

                {/* ── 1. Top Ranking Global ── */}
                <SectionRow
                    title="Top Ranking"
                    icon={IconTrophy}
                    subtitle="Las series más leídas por nuestra comunidad"
                    items={topRankings}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} priority={i < 5} showRank />
                    )}
                />

                {/* Adsterra Banner Display 468x60 */}
                <AdsterraBannerDisplay />

                {/* ── 2. Trending ── */}
                <SectionRow
                    title="Trending"
                    icon={IconFlame}
                    subtitle="Lo que está en tendencia ahora mismo"
                    items={trending}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} priority={i < 4} showViews />
                    )}
                />

                {/* ── 3. Mejor Valoradas ── */}
                <SectionRow
                    title="Mejor Valoradas"
                    icon={IconStar}
                    subtitle="Las series con mayor puntuación de la comunidad"
                    items={topRated}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} priority={i < 4} />
                    )}
                />

                {/* ── 4. Más Vistas (Semana) ── */}
                <SectionRow
                    title="Más Vistas (Semana)"
                    icon={IconEye}
                    subtitle="Las más populares esta semana"
                    items={weeklyPopular}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} showViews />
                    )}
                />

                {/* ── 5. Más Vistas (Mes) ── */}
                <SectionRow
                    title="Más Vistas (Mes)"
                    icon={IconCalendar}
                    subtitle="Las más populares este mes"
                    items={monthlyPopular}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} showViews />
                    )}
                />

                {/* ── 6. Nuevos Lanzamientos ── */}
                <SectionRow
                    title="Nuevos Lanzamientos"
                    icon={IconSparkles}
                    subtitle="Series recién añadidas a la plataforma"
                    items={newReleases}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} />
                    )}
                />

                {/* ── 7. Últimas Actualizaciones ── */}
                <SectionRow
                    title="Últimas Actualizaciones"
                    icon={IconClock}
                    subtitle="Series con capítulos recién publicados"
                    items={latestUpdates}
                    verTodoHref="/biblioteca"
                    renderCard={(item, i) => (
                        <PopularCard key={item.id || item.slug} item={item} index={i} />
                    )}
                />
            </div>
        </div>
    );
}
