import CollectionDiscovery from '@/components/collections/CollectionDiscovery';
import { collectionApi } from '@/lib/collections/server';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Public collections | Manhwa Imperial', robots: { index: false, follow: false } };

export default async function CollectionsPage({ searchParams }) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const data = await collectionApi(`collections?page=${currentPage}`);
  const collections = data?.collections || [];
  const pagination = data?.pagination;

  return <CollectionDiscovery lang="en" collections={collections} pagination={pagination} />;
}
