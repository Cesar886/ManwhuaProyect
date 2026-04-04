import { SITE_URL } from '@/config'
import BusquedaIAClient from './BusquedaIAClient'

function humanizeSlug(slug) {
    return decodeURIComponent(slug || '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

export async function generateMetadata({ params }) {
    const { query } = await params;
    const humanQuery = humanizeSlug(query);
    const canonicalUrl = `${SITE_URL}/busqueda-ia/${query}`;

    return {
        title: `Búsqueda: "${humanQuery}" - Manhwa Imperial`,
        description: `Resultados personalizados por IA para: ${humanQuery}. Encuentra los mejores manhwas según tu búsqueda.`,
        robots: { index: true, follow: true },
        alternates: {
            canonical: canonicalUrl,
        },
        openGraph: {
            title: `Búsqueda: "${humanQuery}" - Manhwa Imperial`,
            description: `Resultados personalizados por IA para: ${humanQuery}`,
            siteName: 'Manhwa Imperial',
            url: canonicalUrl,
        },
    }
}

export default async function BusquedaIAPage({ params }) {
    const { query } = await params
    return <BusquedaIAClient querySlug={query} />
}
