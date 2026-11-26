'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCoverUrls, normalizeImageUrl } from '@/utils/imageUtils';

/**
 * Registry global (módulo): recuerda la última URL exitosa por slug.
 * Persiste durante toda la sesión en memoria del cliente.
 * Actúa como último fallback cuando los datos vienen sin cover.
 */
const coverRegistry = new Map();

const clean = (value) => {
    if (!value) return '';
    const v = String(value).trim();
    if (v === 'undefined' || v === 'null' || v === 'false' || v === '0') return '';
    if (/^(javascript|data|vbscript):/i.test(v)) return '';
    return v;
};

/**
 * ManhwaCover - Componente de imagen para portadas de manhwa
 *
 * Cadena de fallback: src → fallbackSrc → coverRegistry[slug] → gradiente.
 * Cuando una imagen carga correctamente, guarda su URL en el registry
 * para que futuras renders del mismo slug siempre muestren algo.
 *
 * @param {string}  src         - URL principal
 * @param {string}  fallbackSrc - URL alternativa
 * @param {string}  slug        - Slug del manhwa (activa el cover registry)
 * @param {string}  alt         - Texto alternativo SEO
 * @param {string}  className   - Clases CSS
 * @param {React.ReactNode} fallbackContent - Contenido opcional cuando no hay portada disponible
 * @param {boolean} priority    - LCP priority
 */
export default function ManhwaCover({ src, alt, className, fallbackSrc, fallbackContent, slug, series, priority = false }) {
    const coverInput = series || (src && typeof src === 'object' && !Array.isArray(src)) ? (series || src) : null;
    const coverInputKey = coverInput ? getCoverUrls(coverInput).join('\u0000') : '';
    const fallbackValues = Array.isArray(fallbackSrc) ? fallbackSrc : [fallbackSrc];
    const fallbackKey = fallbackValues.map(clean).filter(Boolean).join('\u0000');
    const coverSources = useMemo(() => (
        coverInputKey
            ? coverInputKey.split('\u0000').map(normalizeImageUrl).map(clean).filter(Boolean)
            : []
    ), [coverInputKey]);
    const primary   = useMemo(() => clean(typeof src === 'string' ? src : '') || coverSources[0] || '', [coverSources, src]);
    // fallbackSrc puede ser una URL o una lista. Probamos todas las fuentes
    // porque una URL no vacía también puede estar caída o haber expirado.
    const secondary = useMemo(() => {
        return [...coverSources.slice(1), ...fallbackKey.split('\u0000').map(clean).filter(Boolean)];
    }, [fallbackKey, coverSources]);
    const cached    = slug ? (coverRegistry.get(slug) || '') : '';
    // Algunos registros legacy no tienen ninguna URL en las cuatro columnas.
    // Prueba la ruta pública de ONI por slug antes de caer al placeholder.
    const inferredOni = slug
        ? `https://oni.ntr-files.online/public/archivos/mangas/${encodeURIComponent(slug)}/cover.jpg`
        : '';

    // Lista de fuentes a intentar en orden, sin duplicados
    const sources = useMemo(() => {
        const seen = new Set();
        return [primary, ...secondary, cached, inferredOni].filter(u => {
            if (!u || seen.has(u)) return false;
            seen.add(u);
            return true;
        });
    }, [primary, secondary, cached]);

    // srcIndex avanza con cada onError
    const [srcIndex, setSrcIndex] = useState(0);
    const prevKey = useRef('');

    // Resetear al cambiar props de fuente (nueva serie en el mismo slot)
    useEffect(() => {
        const key = sources.join('|');
        if (prevKey.current !== key) {
            prevKey.current = key;
            setSrcIndex(0);
        }
    }, [sources]);

    const currentSrc = sources[srcIndex] ?? '';
    const failed     = srcIndex >= sources.length;

    const seoAlt = alt || 'Portada de manhwa - Leer manga coreano en español online en Manhwa Imperial';

    if (failed || !currentSrc) {
        return (
            <div
                className={className}
                style={{
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1117 100%)',
                    width: '100%',
                    height: '100%',
                }}
                role="img"
                aria-label={seoAlt}
            >{fallbackContent}</div>
        );
    }

    return (
        <img
            key={currentSrc}
            src={currentSrc}
            alt={seoAlt}
            className={className}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            style={{
                objectFit: 'cover',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
            }}
            onLoad={() => {
                // Guardar URL exitosa en el registry para este slug
                if (slug && currentSrc) coverRegistry.set(slug, currentSrc);
            }}
            onError={() => setSrcIndex((i) => i + 1)}
        />
    );
}
