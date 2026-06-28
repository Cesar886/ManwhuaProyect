'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
 * @param {boolean} priority    - LCP priority
 */
export default function ManhwaCover({ src, alt, className, fallbackSrc, slug, priority = false }) {
    const primary   = useMemo(() => clean(src),         [src]);
    const secondary = useMemo(() => clean(fallbackSrc), [fallbackSrc]);
    const cached    = slug ? (coverRegistry.get(slug) || '') : '';

    // Lista de fuentes a intentar en orden, sin duplicados
    const sources = useMemo(() => {
        const seen = new Set();
        return [primary, secondary, cached].filter(u => {
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
            />
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
