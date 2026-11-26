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
  const canonical = `${SITE_URL}${collectionPath(c, 'en')}`;
  return {
    title: `${c.name} | Manhwa Imperial`,
    description: c.description || `A collection by @${c.creator.username} on Manhwa Imperial.`,
    robots: { index: indexable, follow: indexable },
    ...(indexable ? {
      alternates: { canonical, languages: { es: `${SITE_URL}${collectionPath(c)}`, en: canonical } },
      openGraph: { title: c.name, description: c.description || `A collection by @${c.creator.username}`,
        url: canonical, type: 'website', images: c.coverUrl ? [{ url: c.coverUrl }] : undefined },
    } : {}),
  };
}

export default async function CollectionPage({ params }) {
  const loaded = await load(params);
  if (!loaded?.collection) notFound();
  const c = loaded.collection;
  if (loaded.requested !== `${c.publicId}-${c.slug}`) {
    if (c.visibility === 'public') permanentRedirect(collectionPath(c, 'en'));
    redirect(collectionPath(c, 'en'));
  }
  if (c.type === 'favorites') redirect(`/en/u/${encodeURIComponent(c.creator.username)}/favorites`);
  return <SharedCollectionClient collection={c} lang="en" />;
}
