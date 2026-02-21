import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
    title: 'Acerca de Manhwa Imperial - Plataforma Legal de Manhwa en Español',
    description:
        'Conoce Manhwa Imperial: quiénes somos, nuestra misión, cómo operamos legalmente y nuestro compromiso con los creadores y la comunidad hispanohablante.',
    keywords: [
        'acerca de manhwa imperial',
        'qué es manhwa imperial',
        'plataforma legal manhwa',
        'manhwa imperial misión',
        'manhwa imperial equipo',
        'leer manhwa legal español',
    ],
    openGraph: {
        type: 'website',
        locale: 'es_ES',
        url: `${SITE_URL}/acerca-de`,
        siteName: SITE_NAME,
        title: 'Acerca de Manhwa Imperial - Plataforma Legal de Manhwa en Español',
        description:
            'Conoce nuestra misión, modelo legal, compromiso DMCA y apoyo a los creadores de manhwa.',
        images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
        canonical: `${SITE_URL}/acerca-de`,
    },
}

export default function AcercaDeLayout({ children }) {
    return children
}
