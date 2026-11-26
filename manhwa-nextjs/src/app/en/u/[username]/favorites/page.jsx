import { notFound } from 'next/navigation';
import { SITE_URL } from '@/config';
import { collectionApi, minimumTitles } from '@/lib/collections/server';
import SharedCollectionClient from '@/components/collections/SharedCollectionClient';

export const dynamic = 'force-dynamic';
const load = async (params, searchParams) => {
  const { username } = await params;
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  return { username, page: currentPage,
    data: await collectionApi(`users/${encodeURIComponent(username)}/bookmarks?page=${currentPage}`) };
};
export async function generateMetadata({ params, searchParams }) {
  const { username, page, data } = await load(params, searchParams);
  if (!data) return { robots: { index: false, follow: false } };
  const indexable = data.visibility === 'public' && data.pagination.total >= minimumTitles && page === 1;
  const canonical = `${SITE_URL}/en/u/${encodeURIComponent(username)}/favorites`;
  return { title: `Favorites of @${username} | Manhwa Imperial`,
    robots: { index: indexable, follow: indexable },
    ...(indexable ? { alternates: { canonical, languages: { es: `${SITE_URL}/u/${encodeURIComponent(username)}/favoritos`, en: canonical } },
      openGraph: { title: `Favorites of @${username}`, url: canonical, type: 'website',
        images: data.bookmarks[0]?.series?.coverUrl ? [{ url: data.bookmarks[0].series.coverUrl }] : undefined } } : {}) };
}
export default async function Page({ params, searchParams }) {
  const { username, data } = await load(params, searchParams);
  if (!data) notFound();
  const collection = (await collectionApi(`collections/${data.publicId}`))?.collection;
  if (!collection || collection.creator.username !== username.toLowerCase()) notFound();
  return <SharedCollectionClient collection={collection} lang="en" />;
}
