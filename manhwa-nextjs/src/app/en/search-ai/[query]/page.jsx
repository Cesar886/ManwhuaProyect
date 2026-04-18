import { SITE_URL } from '@/config';
import BusquedaIAClient from '@/app/(es)/busqueda-ia/[query]/BusquedaIAClient';

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
    const canonical = `${SITE_URL}/en/search-ai/${query}`;
    const canonicalEs = `${SITE_URL}/busqueda-ia/${query}`;

    const title = `"${humanQuery}" — AI Manhwa recommendations | Manhwa Imperial`;
    const description = `Manhwas recommended for "${humanQuery}" by our AI engine. Personalized results by genre, plot and similarity across the full English catalog.`;

    return {
        title,
        description,
        keywords: [
            `${humanQuery} manhwa`,
            `similar to ${humanQuery}`,
            `${humanQuery} recommendations`,
            'AI manhwa search',
            'manhwa recommender',
        ],
        robots: { index: true, follow: true },
        alternates: {
            canonical,
            languages: {
                'en-US': canonical,
                'es-ES': canonicalEs,
                'x-default': canonicalEs,
            },
        },
        openGraph: {
            title,
            description,
            type: 'website',
            url: canonical,
            siteName: 'Manhwa Imperial',
            locale: 'en_US',
            alternateLocale: ['es_ES'],
            images: [{ url: '/og-image.png', width: 1200, height: 630, alt: `AI results: ${humanQuery}` }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ['/og-image.png'],
        },
    };
}

export default async function IaSearchEnPage({ params }) {
    const { query } = await params;
    const humanQuery = humanizeSlug(query);
    const canonical = `${SITE_URL}/en/search-ai/${query}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: `AI recommendations for "${humanQuery}"`,
        url: canonical,
        inLanguage: 'en-US',
        isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: 'Manhwa Imperial' },
        breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/en` },
                { '@type': 'ListItem', position: 2, name: 'AI Search', item: `${SITE_URL}/en/search-ai` },
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
