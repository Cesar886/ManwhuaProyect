import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { SITE_URL } from '@/config';
import { collectionApi, collectionPath, minimumTitles } from '@/lib/collections/server';
import SharedCollectionClient from '@/components/collections/SharedCollectionClient';

export const dynamic = 'force-dynamic';

async function load(params) {
  const { publicIdSlug } = await params;
  const match = /^([A-Za-z0-9]{8})-(.+)$/.exec(publicIdSlug);
  if (!match) return null;
  return { collection: (await collectionApi(`collections/${match[1]}`))?.collection, requested: publicIdSlug };
}

export async function generateMetadata({ params }) {
  const loaded = await load(params);
  const c = loaded?.collection;
  if (!c) return { robots: { index: false, follow: false } };
  const indexable = c.visibility === 'public' && c.manhwasCount >= minimumTitles;
  const canonical = `${SITE_URL}${collectionPath(c)}`;
  return {
    title: `${c.name} | Manhwa Imperial`,
    description: c.description || `Colección de @${c.creator.username} en Manhwa Imperial.`,
    robots: { index: indexable, follow: indexable },
    ...(indexable ? {
      alternates: { canonical, languages: { es: canonical, en: `${SITE_URL}${collectionPath(c, 'en')}` } },
      openGraph: { title: c.name, description: c.description || `Colección de @${c.creator.username}`,
        url: canonical, type: 'website', images: c.coverUrl ? [{ url: c.coverUrl }] : undefined },
    } : {}),
  };
}

export default async function CollectionPage({ params }) {
  const loaded = await load(params);
  if (!loaded?.collection) notFound();
  const c = loaded.collection;
  if (loaded.requested !== `${c.publicId}-${c.slug}`) {
    if (c.visibility === 'public') permanentRedirect(collectionPath(c));
    redirect(collectionPath(c));
  }
  if (c.type === 'favorites') redirect(`/u/${encodeURIComponent(c.creator.username)}/favoritos`);
  return <SharedCollectionClient collection={c} lang="es" />;
}
