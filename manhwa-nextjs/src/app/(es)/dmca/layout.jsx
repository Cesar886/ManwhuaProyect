import { SITE_NAME, SITE_URL } from '@/config'

export const metadata = {
    title: 'Política DMCA - Manhwa Imperial',
    description:
        'Política de cumplimiento DMCA de Manhwa Imperial. Procedimiento de notificación y eliminación de contenido por derechos de autor.',
    keywords: [
        'DMCA manhwa',
        'derechos de autor manhwa',
        'takedown notice',
        'copyright manhwa imperial',
        'eliminación de contenido',
    ],
    openGraph: {
        type: 'website',
        locale: 'es_ES',
        url: `${SITE_URL}/dmca`,
        siteName: SITE_NAME,
        title: 'Política DMCA - Manhwa Imperial',
        description:
            'Procedimiento de notificación y eliminación conforme a la DMCA. Agente designado y tiempos de respuesta.',
        images: [{ url: '/og-image.png', width: 1200, height: 630 }],
    },
    alternates: {
        canonical: `${SITE_URL}/dmca`,
        languages: {
            es: '/dmca',
            en: '/en/dmca',
        },
    },
}

export default function DmcaLayout({ children }) {
    return children
}
