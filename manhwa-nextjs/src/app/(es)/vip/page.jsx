import VipClient from './VipClient';
import { SITE_URL, SITE_NAME } from '@/config';

export const metadata = {
    title: 'VIP',
    description: 'Desbloquea scroll infinito, descargas offline, IA sin límites, badges exclusivos y más con la suscripción VIP de Manhwa Imperial.',
    alternates: {
        canonical: '/vip',
    },
    openGraph: {
        title: `VIP — ${SITE_NAME}`,
        description: 'Descubre todas las ventajas exclusivas de ser VIP en Manhwa Imperial.',
        url: `${SITE_URL}/vip`,
        siteName: SITE_NAME,
        type: 'website',
    },
};

export default function VipPage() {
    return <VipClient />;
}
