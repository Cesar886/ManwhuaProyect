import WallClient from '@/components/WallClient';

export const metadata = {
  title: 'Muro de la comunidad | Manhwa Imperial',
  description: 'Participa en el muro de la comunidad de Manhwa Imperial, comparte mensajes y responde a otros lectores.',
  alternates: {
    canonical: '/muro',
    languages: {
      es: '/muro',
      en: '/en/wall',
    },
  },
};

export default function MuroPage() {
  return <WallClient lang="es" />;
}
