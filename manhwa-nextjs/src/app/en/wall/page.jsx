import WallClient from '@/components/WallClient';

export const metadata = {
  title: 'Community Wall | Manhwa Imperial',
  description: 'Join the Manhwa Imperial community wall, share posts and reply to other readers.',
  alternates: {
    canonical: '/en/wall',
    languages: {
      es: '/muro',
      en: '/en/wall',
    },
  },
};

export default function WallPage() {
  return <WallClient lang="en" />;
}
