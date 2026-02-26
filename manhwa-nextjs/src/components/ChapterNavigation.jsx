"use client";

import { useMemo, useCallback, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconChevronLeft, IconChevronRight, IconBook, IconLoader2 } from '@tabler/icons-react';
import styles from './ChapterNavigation.module.css';

/**
 * ChapterNavigation - Navegación Premium Imperial
 *
 * SEO CRÍTICO: Usa etiquetas <Link> (que renderizan <a href>) en lugar de <button onClick>
 * para que Googlebot pueda seguir los enlaces y rastrear todos los capítulos automáticamente.
 *
 * @param {Object} props
 * @param {string|number} props.currentChapter - Número del capítulo actual
 * @param {string} props.slug - Slug del manhwa
 * @param {Array} props.chapters - Lista de capítulos disponibles
 */
const ChapterNavigation = ({ currentChapter, slug, chapters = [], onNavigate }) => {
    const currentNum = parseFloat(currentChapter);
    const pathname = usePathname();
    // 'prev' | 'next' | null — indica qué botón está cargando
    const [navigating, setNavigating] = useState(null);

    // Resetear loading cuando la navegación se completa (pathname cambia)
    useEffect(() => {
        setNavigating(null);
    }, [pathname]);

    // Calcular capítulos anterior y siguiente con validación
    const { prevChapter, nextChapter, hasPrev, hasNext } = useMemo(() => {
        if (!chapters?.length) {
            return {
                prevChapter: currentNum - 1,
                nextChapter: currentNum + 1,
                hasPrev: currentNum > 1,
                hasNext: true
            };
        }

        const sortedChapters = [...chapters].sort((a, b) =>
            parseFloat(a.number) - parseFloat(b.number)
        );

        const currentIndex = sortedChapters.findIndex(
            c => parseFloat(c.number) === currentNum
        );

        if (currentIndex !== -1) {
            const prev = sortedChapters[currentIndex - 1];
            const next = sortedChapters[currentIndex + 1];

            return {
                prevChapter: prev?.number ?? currentNum - 1,
                nextChapter: next?.number ?? currentNum + 1,
                hasPrev: !!prev,
                hasNext: !!next
            };
        }

        const prevNum = currentNum - 1;
        const nextNum = currentNum + 1;

        return {
            prevChapter: prevNum,
            nextChapter: nextNum,
            hasPrev: sortedChapters.some(c => parseFloat(c.number) === prevNum),
            hasNext: sortedChapters.some(c => parseFloat(c.number) === nextNum)
        };
    }, [currentNum, chapters]);

    // Limpiar fullscreen al navegar y mostrar loading
    const handleNavClick = useCallback((direction, targetChapter) => (e) => {
        if (onNavigate) {
            e.preventDefault();
            onNavigate(targetChapter);
            return;
        }
        setNavigating(direction);
        if (document.fullscreenElement) {
            try {
                document.exitFullscreen();
            } catch (error) {
                // Silently handle fullscreen exit errors
            }
        }
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
    }, [onNavigate]);

    // Formatear número de capítulo (ej: 115.5 -> "115.5")
    const formatChapterNum = (num) => {
        return Number.isInteger(parseFloat(num))
            ? Math.floor(num).toString()
            : num.toString();
    };

    return (
        <nav
            className={styles.controlsFooter}
            aria-label="Navegación de capítulos"
            role="navigation"
        >
            {/* SEO: Enlace <a> real al Capítulo Anterior para que Googlebot pueda rastrearlo */}
            {hasPrev ? (
                <Link
                    href={`/manhwa/${slug}/capitulo/${prevChapter}`}
                    className={`${styles.chapterNav} ${styles.secondary} ${navigating === 'prev' ? styles.navigating : ''}`}
                    aria-label={`Ir al capítulo anterior: ${prevChapter}`}
                    title={`Capítulo ${formatChapterNum(prevChapter)}`}
                    onClick={handleNavClick('prev', prevChapter)}
                >
                    {navigating === 'prev' ? (
                        <IconLoader2
                            stroke={2.5}
                            size={18}
                            className={styles.spinnerIcon}
                            aria-hidden="true"
                        />
                    ) : (
                        <IconChevronLeft
                            stroke={2.5}
                            size={18}
                            aria-hidden="true"
                        />
                    )}
                    <span>
                        {navigating === 'prev' ? 'Cargando...' : `Cap. ${formatChapterNum(prevChapter)}`}
                    </span>
                    <span>
                        {navigating === 'prev' ? '...' : formatChapterNum(prevChapter)}
                    </span>
                </Link>
            ) : (
                <span
                    className={`${styles.chapterNav} ${styles.secondary} ${styles.disabled}`}
                    aria-label="No hay capítulo anterior"
                    aria-disabled="true"
                >
                    <IconChevronLeft
                        stroke={2.5}
                        size={18}
                        aria-hidden="true"
                    />
                    <span>Anterior</span>
                    <span>Ant.</span>
                </span>
            )}

            {/* Botón Central - Ver Todos los Capítulos */}
            <Link
                href={`/manhwa/${slug}`}
                className={`${styles.chapterNav} ${styles.primary}`}
                aria-label="Lista de capítulos"
                title="Ver todos los capítulos"
            >
                <IconBook
                    stroke={2.5}
                    size={20}
                    aria-hidden="true"
                />
                <span>Capítulos</span>
            </Link>

            {/* SEO: Enlace <a> real al Capítulo Siguiente para que Googlebot pueda rastrearlo */}
            {hasNext ? (
                <Link
                    href={`/manhwa/${slug}/capitulo/${nextChapter}`}
                    className={`${styles.chapterNav} ${styles.secondary} ${navigating === 'next' ? styles.navigating : ''}`}
                    aria-label={`Ir al capítulo siguiente: ${nextChapter}`}
                    title={`Capítulo ${formatChapterNum(nextChapter)}`}
                    onClick={handleNavClick('next', nextChapter)}
                >
                    <span>
                        {navigating === 'next' ? 'Cargando...' : `Cap. ${formatChapterNum(nextChapter)}`}
                    </span>
                    <span>
                        {navigating === 'next' ? '...' : formatChapterNum(nextChapter)}
                    </span>
                    {navigating === 'next' ? (
                        <IconLoader2
                            stroke={2.5}
                            size={18}
                            className={styles.spinnerIcon}
                            aria-hidden="true"
                        />
                    ) : (
                        <IconChevronRight
                            stroke={2.5}
                            size={18}
                            aria-hidden="true"
                        />
                    )}
                </Link>
            ) : (
                <span
                    className={`${styles.chapterNav} ${styles.secondary} ${styles.disabled}`}
                    aria-label="No hay capítulo siguiente"
                    aria-disabled="true"
                >
                    <span>Siguiente</span>
                    <span>Sig.</span>
                    <IconChevronRight
                        stroke={2.5}
                        size={18}
                        aria-hidden="true"
                    />
                </span>
            )}
        </nav>
    );
};

export default ChapterNavigation;