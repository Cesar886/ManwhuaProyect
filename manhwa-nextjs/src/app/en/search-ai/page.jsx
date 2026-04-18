import { SITE_URL } from '@/config';
import BusquedaIAClient from '@/app/(es)/busqueda-ia/[query]/BusquedaIAClient';

const TITLE = 'AI Search — Smart Manhwa recommender | Manhwa Imperial';
const DESCRIPTION =
    'Describe the manhwa you want and our AI recommends matching titles: by genre, plot, protagonist or vibe. Semantic engine trained on the full English catalog.';
const CANONICAL = `${SITE_URL}/en/search-ai`;
const CANONICAL_ES = `${SITE_URL}/busqueda-ia`;

export const metadata = {
    title: TITLE,
    description: DESCRIPTION,
    keywords: [
        'AI manhwa search',
        'manhwa recommender',
        'find manhwa by plot',
        'similar manhwas',
        'AI manhwa recommendations',
        'manhwa search engine',
    ],
    robots: { index: true, follow: true },
    alternates: {
        canonical: CANONICAL,
        languages: {
            'en-US': CANONICAL,
            'es-ES': CANONICAL_ES,
            'x-default': CANONICAL_ES,
        },
    },
    openGraph: {
        title: TITLE,
        description: DESCRIPTION,
        type: 'website',
        url: CANONICAL,
        siteName: 'Manhwa Imperial',
        locale: 'en_US',
        alternateLocale: ['es_ES'],
        images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'AI Search — Manhwa Imperial' }],
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
    name: 'AI Manhwa Search',
    url: CANONICAL,
    applicationCategory: 'EntertainmentApplication',
    operatingSystem: 'Web',
    description: DESCRIPTION,
    inLanguage: 'en-US',
    isPartOf: { '@type': 'WebSite', '@id': `${SITE_URL}#website`, url: SITE_URL, name: 'Manhwa Imperial' },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/en/search-ai/{search_term_string}` },
        'query-input': 'required name=search_term_string',
    },
};

export default function SearchAIBasePage() {
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
