import { SITE_URL } from '@/config';
import BusquedaIAClient from './BusquedaIAClient';

function humanizeSlug(slug) {
    return decodeURIComponent(slug || '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim()
        .slice(0, 100);
}

export async function generateMetadata({ params }) {
    const { query } = await params;
    const humanQuery = humanizeSlug(query);
    const canonical = `${SITE_URL}/busqueda-ia/${query}`;
    const canonicalEn = `${SITE_URL}/en/search-ai/${query}`;

    const title = `"${humanQuery}" — Recomendaciones IA de Manhwas | Manhwa Imperial`;
    const description = `Manhwas recomendados para "${humanQuery}" con nuestro buscador IA. Resultados personalizados por género, trama y similitud sobre el catálogo completo en español.`;

    return {
        title,
        description,
        keywords: [
            `manhwas ${humanQuery}`,
            `recomendaciones ${humanQuery}`,
            `similar a ${humanQuery}`,
            'búsqueda IA manhwas',
            'recomendador manhwas',
        ],
        robots: { index: true, follow: true },
        alternates: {
            canonical,
            languages: {
                'es-ES': canonical,
                'en-US': canonicalEn,
                'x-default': canonical,
            },
        },
        openGraph: {
            title,
            description,
            type: 'website',
            url: canonical,
            siteName: 'Manhwa Imperial',
            locale: 'es_ES',
            alternateLocale: ['en_US'],
            images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `Resultados IA: ${humanQuery}` }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ['/og-image.png'],
        },
    };
}

export default async function BusquedaIAPage({ params }) {
    const { query } = await params;
    const humanQuery = humanizeSlug(query);
    const canonical = `${SITE_URL}/busqueda-ia/${query}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: `Recomendaciones IA para "${humanQuery}"`,
        url: canonical,
        inLanguage: 'es-ES',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: 'Manhwa Imperial' },
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
                { '@type': 'ListItem', position: 2, name: 'Búsqueda IA', item: `${SITE_URL}/busqueda-ia` },
                { '@type': 'ListItem', position: 3, name: humanQuery, item: canonical },
            ],
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <BusquedaIAClient querySlug={query} />
        </>
    );
}
