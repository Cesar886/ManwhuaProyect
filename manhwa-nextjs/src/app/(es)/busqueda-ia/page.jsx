import { SITE_URL } from '@/config'
import BusquedaIAClient from './[query]/BusquedaIAClient'

export const metadata = {
    title: 'Búsqueda IA - Manhwa Imperial',
    description: 'Busca manhwas con inteligencia artificial en Manhwa Imperial.',
    robots: { index: true, follow: true },
    alternates: {
        canonical: `${SITE_URL}/busqueda-ia`,
    },
}

export default function BusquedaIABasePage() {
    return <BusquedaIAClient querySlug="" />
}