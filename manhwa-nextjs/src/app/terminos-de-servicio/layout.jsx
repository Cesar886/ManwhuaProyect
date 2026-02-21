import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
    title: 'Términos de Servicio - Manhwa Imperial',
    description:
        'Términos y condiciones de uso de Manhwa Imperial. Derechos, obligaciones y políticas legales de la plataforma.',
    keywords: ['términos de servicio manhwa', 'condiciones de uso', 'políticas manhwa imperial'],
    openGraph: {
        type: 'website',
        locale: 'es_ES',
        url: `${SITE_URL}/terminos-de-servicio`,
        siteName: SITE_NAME,
        title: 'Términos de Servicio - Manhwa Imperial',
        description: 'Términos y condiciones que rigen el uso de la plataforma Manhwa Imperial.',
        images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
        canonical: `${SITE_URL}/terminos-de-servicio`,
    },
}

export default function TerminosLayout({ children }) {
    return children
}
