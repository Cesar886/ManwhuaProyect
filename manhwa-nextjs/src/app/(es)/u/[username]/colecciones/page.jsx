import { notFound } from 'next/navigation';
import { collectionApi } from '@/lib/collections/server';
import UserCollectionList from '@/components/collections/UserCollectionList';

export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }) {
  const { username } = await params;
  const { page } = await searchParams;
  const data = await collectionApi(`users/${encodeURIComponent(username)}/collections?page=${Math.max(1, Number(page) || 1)}`);
  if (!data) notFound();
  return <UserCollectionList username={username} collections={data.collections} pagination={data.pagination} />;
}
