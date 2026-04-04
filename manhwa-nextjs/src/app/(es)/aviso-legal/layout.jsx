import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
    title: 'Aviso Legal - Manhwa Imperial',
    description:
        'Aviso legal y descargo de responsabilidad de Manhwa Imperial. Naturaleza del servicio, derechos de autor y contacto legal.',
    keywords: ['aviso legal manhwa', 'descargo de responsabilidad', 'manhwa imperial legal'],
    openGraph: {
        type: 'website',
        locale: 'es_ES',
        url: `${SITE_URL}/aviso-legal`,
        siteName: SITE_NAME,
        title: 'Aviso Legal - Manhwa Imperial',
        description:
            'Aviso legal, naturaleza del servicio y descargo de responsabilidad de Manhwa Imperial.',
        images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
        canonical: `${SITE_URL}/aviso-legal`,
        languages: {
            es: '/aviso-legal',
            en: '/en/legal-notice',
        },
    },
}

export default function AvisoLegalLayout({ children }) {
    return children
}
