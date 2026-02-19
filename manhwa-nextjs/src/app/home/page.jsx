"use client";

import Link from 'next/link';
import { useMemo } from 'react';
import {
  IconClock,
  IconEye,
  IconTrendingUp,
  IconTrophy,
  IconSparkles,
  IconRefresh,
  IconBook,
  IconDiamond,
} from '@tabler/icons-react';
import { PremiumSkeletonGrid } from '../../components/PremiumSkeleton';
import ManhwaCover from '../../components/ManhwaCover';
import styles from './Home.module.css';
import { useSpaces } from '../../hooks/useSpaces';
import { normalizeImageUrl } from '../../utils/imageUtils';
import Header from '@/components/Header';
import { SEO_CONTENT, getImageAlt, getAnchorText } from '@/lib/seo/constants';

// ============================================================================
// COMPONENTE PRINCIPAL - CONECTADO A DIGITALOCEAN SPACES VIA WEBHOOK/SSE
// Con optimización SEO para keywords: manhwa, leer manhwa, manhwa en español
// ============================================================================

export default function Home() {
  // Hook REST optimizado para cargar manhwas desde Spaces (150-200ms)
  const { series: spacesSeries, loading, error, refresh, isFromCache } = useSpaces();

  // Mostrar skeleton mientras se cargan los datos por primera vez
  if (loading && spacesSeries.length === 0) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.content}>
          {/* H1 SEO incluso durante la carga */}
          <h1 className={styles.seoH1}>{SEO_CONTENT.home.h1}</h1>

          <section>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <IconTrendingUp size={22} />
              </div>
              <h2 className={styles.sectionTitle}>{SEO_CONTENT.home.sections.popular}</h2>
            </div>
            <div className={styles.cardsRow}>
              <PremiumSkeletonGrid count={12} />
            </div>
          </section>

          <section>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <IconClock size={22} />
              </div>
              <h2 className={styles.sectionTitle}>{SEO_CONTENT.home.sections.latest}</h2>
            </div>
            <div className={styles.gridReleases}>
              <PremiumSkeletonGrid count={6} />
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.content}>
        <Header title="Inicio" />

        {/* ================================================================== */}
        {/* SEO: H1 PRINCIPAL - Keyword "Leer Manhwa en Español Online Gratis" */}
        {/* ================================================================== */}
        <h1 className={styles.seoH1}>{SEO_CONTENT.home.h1}</h1>

        {/* ================================================================== */}
        {/* SEO: PÁRRAFO INTRODUCTORIO CON KEYWORDS NATURALES */}
        {/* ================================================================== */}
        <p className={styles.seoIntro}>
          {SEO_CONTENT.home.introText}
        </p>

        {isFromCache && (
          <div className={styles.cacheNotice}>
            <button
              onClick={refresh}
              disabled={loading}
              className={styles.inlineBtn}
            >
              <IconRefresh size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Actualizando...' : 'Actualizar contenido'}
            </button>
          </div>
        )}

        {error && (
          <div className={styles.errorMessage}>
            <p>{error}</p>
          </div>
        )}

        {/* ================================================================== */}
        {/* MANHWAS DESTACADOS - SEO: "Manhwas Populares en Español" */}
        {/* ================================================================== */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <IconSparkles size={22} />
            </div>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.home.sections.collection}
            </h2>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.875rem',
              color: 'var(--text-muted)',
              fontWeight: 500
            }}>
              {spacesSeries.length} títulos
            </span>
          </div>

          <div className={styles.cardsRow}>
            {spacesSeries.slice(0, 12).map((series, index) => (
              <Link
                href={`/manhwa/${series.slug}`}
                key={series.slug}
                className={styles.popularItem}
                title={getAnchorText.title(series.title)}
              >
                <div className={styles.popularCard}>
                  <ManhwaCover
                    src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                    alt={getImageAlt.cover(series.title)}
                    className={styles.popularImg}
                    priority={index < 4}
                    sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 160px"
                  />
                  {series.chapterCount > 0 && (
                    <span className={styles.chapterBadge}>
                      {series.chapterCount} caps
                    </span>
                  )}
                  <span className={styles.statusBadge}>
                    {series.status || 'ongoing'}
                  </span>
                  <h3 className={styles.titleLink}>{series.title}</h3>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ================================================================== */}
        {/* ÚLTIMAS ACTUALIZACIONES - SEO: "Últimos Manhwas Actualizados" */}
        {/* ================================================================== */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <IconClock size={22} />
            </div>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.home.sections.latest}
            </h2>
            <Link href="/biblioteca" className={styles.inlineBtn}>
              {getAnchorText.seeAll}
            </Link>
          </div>

          <div className={styles.gridReleases}>
            {spacesSeries.slice(0, 6).map((series) => (
              <div key={series.slug} className={styles.releaseCard}>
                <Link href={`/manhwa/${series.slug}`} title={getAnchorText.title(series.title)}>
                  <div className={styles.releaseCoverWrapper}>
                    <ManhwaCover
                      src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                      alt={getImageAlt.cover(series.title)}
                      className={styles.popularImg}
                      sizes="(max-width: 640px) 30vw, (max-width: 1024px) 18vw, 120px"
                    />
                  </div>
                </Link>
                <div className={styles.releaseInfo}>
                  <Link href={`/manhwa/${series.slug}`} className={styles.releaseTitle} title={getAnchorText.title(series.title)}>
                    {series.title}
                  </Link>
                  <div className={styles.chaptersList}>
                    {(series.chapters || []).slice(0, 3).map((ch) => (
                      <Link
                        key={ch.number}
                        href={`/manhwa/${series.slug}/capitulo/${ch.number}`}
                        className={styles.chapterLink}
                        title={getAnchorText.chapter(series.title, ch.number)}
                      >
                        <span>Capítulo {ch.number}</span>
                        <span className={styles.chapterTime}>{ch.time}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ================================================================== */}
        {/* JOYAS OCULTAS - SEO: Enlazado interno a manhwas menos conocidos */}
        {/* Rota semanalmente para distribuir autoridad SEO */}
        {/* ================================================================== */}
        {spacesSeries.length > 12 && (
          <section>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <IconDiamond size={22} />
              </div>
              <h2 className={styles.sectionTitle}>
                Joyas Ocultas - Manhwas que Deberías Leer
              </h2>
              <Link href="/biblioteca" className={`${styles.inlineBtn} ${styles.hideOnMobile}`}>
                Explorar biblioteca
              </Link>
            </div>

            <div className={styles.cardsRow}>
              {(() => {
                // Rotación semanal determinista basada en la semana del año
                const weekNumber = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
                const startOffset = 12 + ((weekNumber * 6) % Math.max(1, spacesSeries.length - 18));
                return spacesSeries.slice(startOffset, startOffset + 6).map((series) => (
                  <Link
                    href={`/manhwa/${series.slug}`}
                    key={series.slug}
                    className={styles.popularItem}
                    title={getAnchorText.title(series.title)}
                  >
                    <div className={styles.popularCard}>
                      <ManhwaCover
                        src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                        alt={getImageAlt.cover(series.title)}
                        className={styles.popularImg}
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 160px"
                      />
                      {series.chapterCount > 0 && (
                        <span className={styles.chapterBadge}>
                          {series.chapterCount} caps
                        </span>
                      )}
                      <h3 className={styles.titleLink}>{series.title}</h3>
                    </div>
                  </Link>
                ));
              })()}
            </div>
          </section>
        )}

        {/* ================================================================== */}
        {/* TOP SERIES (RANKINGS) - SEO: "Manhwas Populares en Español" */}
        {/* ================================================================== */}
        <section>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <IconTrophy size={22} />
            </div>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.home.sections.popular}
            </h2>
            <Link href="/populares" className={`${styles.inlineBtn} ${styles.hideOnMobile}`}>
              {getAnchorText.fullRanking}
            </Link>
          </div>

          <div className={styles.topSeriesGrid}>
            {/* Top 3 - Featured Cards */}
            <div className={styles.topSeriesContainer}>
              {spacesSeries.slice(0, 3).map((series, index) => (
                <Link
                  href={`/manhwa/${series.slug}`}
                  key={series.slug}
                  className={styles.topSeriesItem}
                  title={getAnchorText.title(series.title)}
                >
                  <div className={styles.topSeriesCover}>
                    <ManhwaCover
                      src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                      alt={getImageAlt.cover(series.title)}
                      sizes="(max-width: 640px) 80vw, (max-width: 1024px) 30vw, 250px"
                    />
                    <div
                      className={styles.topSeriesBadge}
                      style={{
                        backgroundImage: index === 0
                          ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                          : index === 1
                            ? 'linear-gradient(135deg, #E8E8E8, #A8A8A8)'
                            : 'linear-gradient(135deg, #CD7F32, #8B4513)',
                      }}
                    >
                      {index + 1}
                    </div>
                  </div>
                  <div className={styles.topSeriesInfo}>
                    <h3 className={styles.topSeriesTitle}>{series.title}</h3>
                    {series.chapterCount > 0 && (
                      <div className={styles.topSeriesMeta}>
                        <IconEye size={14} />
                        <span>{series.chapterCount} capítulos</span>
                      </div>
                    )}
                    <span className={styles.btnPrimary}>Leer manhwa</span>
                  </div>
                </Link>
              ))}
            </div>

            {/* 4-10 - Side List */}
            <div className={`${styles.listPanel} ${styles.hideOnMobile}`}>
              <h3 className={styles.listPanelTitle}>
                <IconTrendingUp size={18} />
                Mejores Manhwas
              </h3>
              <div>
                {spacesSeries.slice(3, 10).map((series, index) => (
                  <Link
                    href={`/manhwa/${series.slug}`}
                    key={series.slug}
                    className={styles.listItem}
                    title={getAnchorText.title(series.title)}
                  >
                    <span className={styles.listItemRank}>{index + 4}</span>
                    <div className={styles.listItemCover} style={{ position: 'relative', overflow: 'hidden' }}>
                      <ManhwaCover
                        src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                        alt={getImageAlt.cover(series.title)}
                        sizes="48px"
                      />
                    </div>
                    <div className={styles.listItemInfo}>
                      <h4 className={styles.listItemTitle}>{series.title}</h4>
                      {series.chapterCount > 0 && (
                        <span className={styles.listItemChapters}>{series.chapterCount} capítulos</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/* SEO: SECCIÓN ¿QUÉ ES UN MANHWA? - Contenido informativo para SEO */}
        {/* ================================================================== */}
        <section className={styles.seoSection}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>
              <IconBook size={22} />
            </div>
            <h2 className={styles.sectionTitle}>
              {SEO_CONTENT.home.whatIsManhwa.title}
            </h2>
          </div>
          <div className={styles.seoContent}>
            <p>{SEO_CONTENT.home.whatIsManhwa.text}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
