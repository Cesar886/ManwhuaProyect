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

    return {
        title: `Búsqueda: "${humanQuery}" - Manhwa Imperial`,
        description: `Resultados personalizados por IA para: ${humanQuery}. Encuentra los mejores manhwas según tu búsqueda.`,
        robots: { index: false, follow: false },
        alternates: {
            canonical: `${SITE_URL}/biblioteca`,
        },
        openGraph: {
            title: `Búsqueda: "${humanQuery}" - Manhwa Imperial`,
            description: `Resultados personalizados por IA para: ${humanQuery}`,
            siteName: 'Manhwa Imperial',
        },
    }
}

export default async function BusquedaIAPage({ params }) {
    const { query } = await params
    return <BusquedaIAClient querySlug={query} />
}
