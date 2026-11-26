import MyCollectionsClient from './MyCollectionsClient';

export const metadata = {
  title: 'Mis colecciones | Manhwa Imperial',
  robots: { index: false, follow: false },
};

export default function MyCollectionsPage() {
  return <MyCollectionsClient lang="es" />;
}
