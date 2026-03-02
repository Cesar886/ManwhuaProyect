'use client';

import { useState } from 'react';

/**
 * ManhwaCover - Componente de imagen para portadas de manhwa
 *
 * Sirve las imágenes directamente desde su URL original sin pasar por /_next/image.
 *
 * @param {string} src - URL de la imagen
 * @param {string} alt - Texto alternativo (IMPORTANTE para SEO: incluir "manhwa")
 * @param {string} className - Clases CSS adicionales
 * @param {boolean} priority - Si es true, se carga con prioridad (LCP)
 */
export default function ManhwaCover({ src, alt, className, priority = false }) {
    const [imageError, setImageError] = useState(false);

    const seoAlt = alt || 'Portada de manhwa - Leer manga coreano en español online en Manhwa Imperial';

    if (imageError || !src) {
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
            src={src}
            alt={seoAlt}
            className={className}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            style={{
                objectFit: 'cover',
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
            }}
            onError={() => setImageError(true)}
        />
    );
}
