import { SITE_URL } from '@/config'
import BusquedaIAClient from '@/app/(es)/busqueda-ia/[query]/BusquedaIAClient'

function humanizeSlug(slug) {
    return decodeURIComponent(slug || '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export async function generateMetadata({ params }) {
    const { query } = await params;
    const humanQuery = humanizeSlug(query);
    const canonicalUrl = `${SITE_URL}/en/search-ai/${query}`;

    return {
        title: `Search: "${humanQuery}" - Manhwa Imperial`,
        description: `AI-personalized results for: ${humanQuery}. Find the best manhwas based on your search.`,
        robots: { index: true, follow: true },
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: `Search: "${humanQuery}" - Manhwa Imperial`,
            description: `AI-personalized results for: ${humanQuery}`,
            siteName: 'Manhwa Imperial',
            url: canonicalUrl,
        },
    }
}

export default async function IaSearchEnPage({ params }) {
    const { query } = await params
    return <BusquedaIAClient querySlug={query} />
}
