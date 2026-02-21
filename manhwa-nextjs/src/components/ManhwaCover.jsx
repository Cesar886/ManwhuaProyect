'use client';

import { useState } from 'react';
import Image from 'next/image';

// Tiny 1x1 pixel blurred SVG placeholder (avoids CLS and improves perceived speed)
const BLUR_PLACEHOLDER =
    'data:image/svg+xml;base64,' +
    btoa(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="54"><rect width="40" height="54" fill="#1a1a2e"/><rect width="40" height="54" fill="url(#g)" opacity=".4"/><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2a1f4e"/><stop offset="100%" stop-color="#0d1117"/></linearGradient></defs></svg>'
    );

/**
 * ManhwaCover - Componente de imagen optimizado para portadas de manhwa
 * 
 * SEO: El atributo alt debe incluir la palabra "manhwa" para reforzar keywords.
 * Ejemplo de uso:
 *   <ManhwaCover src={coverUrl} alt={`${title} manhwa - Leer en español`} />
 * 
 * @param {string} src - URL de la imagen
 * @param {string} alt - Texto alternativo (IMPORTANTE para SEO: incluir "manhwa")
 * @param {string} className - Clases CSS adicionales
 * @param {boolean} priority - Si es true, se carga con prioridad (LCP)
 * @param {string} sizes - Tamaños responsivos para srcset
 */
export default function ManhwaCover({ src, alt, className, priority = false, sizes }) {
    const [imageError, setImageError] = useState(false);

    // SEO: Asegurar que el alt siempre incluya información útil y narrativa para Visión de IA
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
        <Image
            src={src}
            alt={seoAlt}
            className={className}
            fill
            sizes={sizes || '(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 180px'}
            style={{ objectFit: 'cover' }}
            loading={priority ? 'eager' : 'lazy'}
            priority={priority}
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            onError={() => setImageError(true)}
        />
    );
}
