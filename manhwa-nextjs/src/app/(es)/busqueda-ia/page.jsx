import { SITE_URL } from '@/config';
import BusquedaIAClient from './[query]/BusquedaIAClient';

const TITLE = 'Búsqueda IA — Recomendador inteligente de Manhwas | Manhwa Imperial';
const DESCRIPTION =
    'Describe el manhwa que buscas y nuestra IA te recomienda títulos afines: por género, trama, protagonista o vibe. Motor semántico entrenado sobre el catálogo completo en español.';
const CANONICAL = `${SITE_URL}/busqueda-ia`;
const CANONICAL_EN = `${SITE_URL}/en/search-ai`;

export const metadata = {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: true, follow: true },
    alternates: {
        canonical: CANONICAL,
        languages: {
            'es-ES': CANONICAL,
            'en-US': CANONICAL_EN,
            'x-default': CANONICAL,
        },
    },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: 'website',
        url: CANONICAL,
        siteName: 'Manhwa Imperial',
        locale: 'es_ES',
        alternateLocale: ['en_US'],
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Búsqueda IA — Manhwa Imperial' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: TITLE,
        description: DESCRIPTION,
        images: ['/og-image.png'],
    },
};

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Búsqueda IA de Manhwas',
    url: CANONICAL,
    applicationCategory: 'EntertainmentApplication',
    operatingSystem: 'Web',
    description: DESCRIPTION,
    inLanguage: 'es-ES',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: 'Manhwa Imperial' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/busqueda-ia/{search_term_string}` },
        'query-input': 'required name=search_term_string',
    },
};

export default function BusquedaIABasePage() {
    return (
        <>
            <script
                type="application/ld+json"
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <BusquedaIAClient querySlug="" />
        </>
    );
}
