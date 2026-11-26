import MyCollectionsClient from '../../(es)/mis-colecciones/MyCollectionsClient';

export const metadata = {
  title: 'My collections | Manhwa Imperial',
  robots: { index: false, follow: false },
};

export default function MyCollectionsPage() {
  return <MyCollectionsClient lang="en" />;
}
