import { notFound, redirect } from 'next/navigation';
import { collectionApi } from '@/lib/collections/server';
import SharedCollectionClient from '@/components/collections/SharedCollectionClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Editar colección | Manhwa Imperial', robots: { index: false, follow: false } };

export default async function ManageCollectionPage({ params }) {
  const { slug } = await params;
  const mine = (await collectionApi('collections/mine'))?.collections || [];
  if (slug === '__favorites__' && !mine.length) redirect('/mis-colecciones');
  const collection = mine.find(item => item.publicId === slug || item.legacySlug === slug || (slug === '__favorites__' && item.type === 'favorites'));
  if (!collection) notFound();
  if (slug !== collection.publicId) {
    if (collection.type === 'favorites') {
      const me = (await collectionApi('auth/me'))?.user;
      if (me?.username) redirect(`/u/${encodeURIComponent(me.username)}/favoritos`);
    }
    redirect(`/mis-colecciones/${collection.publicId}`);
  }
  return <SharedCollectionClient collection={collection} lang="es" manage />;
}
