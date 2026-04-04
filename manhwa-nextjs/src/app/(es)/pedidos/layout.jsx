export const metadata = {
  title: 'Solicitar Manhwas - Pide Nuevas Series',
  description: 'Solicita nuevos manhwas para que sean agregados a Manhwa Imperial. Vota por las series que más te interesan y ayuda a decidir qué se sube próximamente.',
  keywords: ['solicitar manhwa', 'pedir series', 'votar manhwa', 'nuevas series'],
  alternates: {
    canonical: '/pedidos',
  },
  openGraph: {
    title: 'Solicitar Manhwas - Pide Nuevas Series',
    description: 'Solicita y vota por nuevos manhwas para que sean agregados a la plataforma.',
    type: 'website',
    url: '/pedidos',
    locale: 'es_ES',
  },
}

export default function PedidosLayout({ children }) {
  return children
}
