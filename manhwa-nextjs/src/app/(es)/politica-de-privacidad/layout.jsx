import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
    title: 'Política de Privacidad - Manhwa Imperial',
    description:
        'Política de privacidad y protección de datos de Manhwa Imperial. Cómo recopilamos, usamos y protegemos su información.',
    keywords: [
        'política de privacidad manhwa',
        'protección de datos',
        'privacidad manhwa imperial',
        'cookies manhwa',
    ],
    openGraph: {
        type: 'website',
        locale: 'es_ES',
        url: `${SITE_URL}/politica-de-privacidad`,
        siteName: SITE_NAME,
        title: 'Política de Privacidad - Manhwa Imperial',
        description:
            'Cómo recopilamos, usamos y protegemos tu información personal en Manhwa Imperial.',
        images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
        canonical: `${SITE_URL}/politica-de-privacidad`,
        languages: {
            es: '/politica-de-privacidad',
            en: '/en/privacy-policy',
        },
    },
}

export default function PrivacidadLayout({ children }) {
    return children
}
