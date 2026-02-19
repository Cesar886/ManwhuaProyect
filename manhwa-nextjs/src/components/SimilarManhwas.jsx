"use client";

import { useMemo } from 'react';
import Link from 'next/link';
import ManhwaCover from './ManhwaCover';
import { normalizeImageUrl } from '../utils/imageUtils';
import { useSpaces } from '../hooks/useSpaces';
import { getImageAlt, getAnchorText, SEO_CONTENT } from '@/lib/seo/constants';
import styles from './SimilarManhwas.module.css';

/**
 * SimilarManhwas - Sección "Te podría gustar" para enlazado interno SEO
 *
 * Muestra manhwas que comparten géneros con la serie actual.
 * Transfiere autoridad SEO entre páginas y retiene al lector.
 *
 * @param {Object} props
 * @param {Object} props.currentSeries - Serie actual (para extraer géneros y slug)
 */
export default function SimilarManhwas({ currentSeries }) {
  const { series: allSeries } = useSpaces();

  const similarManhwas = useMemo(() => {
    if (!currentSeries || !allSeries?.length) return [];

    // Extraer géneros de la serie actual
    const currentGenres = (currentSeries.genres || []).map(g =>
      (typeof g === 'string' ? g : g?.name || '').toLowerCase()
    ).filter(Boolean);

    if (currentGenres.length === 0) return [];

    // Calcular puntuación de similitud por géneros compartidos
    const scored = allSeries
      .filter(s => s.slug !== currentSeries.slug)
      .map(s => {
        const genres = (s.genres || []).map(g =>
          (typeof g === 'string' ? g : g?.name || '').toLowerCase()
        ).filter(Boolean);
        const shared = currentGenres.filter(g => genres.includes(g)).length;
        return { ...s, similarityScore: shared };
      })
      .filter(s => s.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore);

    return scored.slice(0, 5);
  }, [currentSeries, allSeries]);

  if (similarManhwas.length === 0) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.title}>
        {SEO_CONTENT.manhwaDetail.getSimilarTitle(currentSeries.title)}
      </h2>
      <p className={styles.subtitle}>
        Si te gusta {currentSeries.title}, estos manhwas también te encantarán
      </p>
      <div className={styles.grid}>
        {similarManhwas.map((series) => (
          <Link
            key={series.slug}
            href={`/manhwa/${series.slug}`}
            className={styles.card}
            title={getAnchorText.title(series.title)}
          >
            <div className={styles.coverWrapper}>
              <ManhwaCover
                src={normalizeImageUrl(series.cover || series.coverUrl || series.cover_url) || ''}
                alt={getImageAlt.cover(series.title)}
                className={styles.cover}
                sizes="(max-width: 640px) 30vw, 120px"
              />
            </div>
            <div className={styles.info}>
              <h3 className={styles.name}>{series.title}</h3>
              <div className={styles.genres}>
                {(series.genres || []).slice(0, 2).map((g, i) => {
                  const name = typeof g === 'string' ? g : g?.name || '';
                  return <span key={i} className={styles.genre}>{name}</span>;
                })}
              </div>
              {series.chapterCount > 0 && (
                <span className={styles.chapters}>{series.chapterCount} capítulos</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
