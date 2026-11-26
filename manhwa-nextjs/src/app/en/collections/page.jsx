import Link from 'next/link';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import { collectionApi, collectionPath } from '@/lib/collections/server';
import styles from '@/components/collections/SharedCollection.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Public collections | Manhwa Imperial', robots: { index: false, follow: false } };

export default async function CollectionsPage({ searchParams }) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const data = await collectionApi(`collections?page=${currentPage}`);
  const collections = data?.collections || [];
  const pagination = data?.pagination;

  return <main className={styles.page}>
    <Header lang="en" />
    <div className={styles.container}>
      <h1>Public collections</h1>
      <p>Explore lists shared by the community.</p>
      <p><Link href="/en/my-collections">My collections</Link></p>
      <div className={styles.grid}>{collections.map(c => <article className={styles.card} key={c.publicId}>
        <Link href={c.type === 'favorites' ? `/en/u/${encodeURIComponent(c.creator.username)}/favorites` : collectionPath(c, 'en')}>
          <div className={styles.cover}><ManhwaCover src={c.coverUrl || c.previewSeries?.[0]} alt={c.name} /></div>
          <strong>{c.name}</strong>
          <span>@{c.creator.username} · {c.manhwasCount} titles · {c.likesCount} likes</span>
        </Link>
      </article>)}</div>
      {!collections.length && <p>No public collections yet.</p>}
      {pagination?.page > 1 && <Link href={`/en/collections?page=${pagination.page - 1}`}>Previous</Link>}
      {pagination?.page < pagination.pages && <Link href={`/en/collections?page=${pagination.page + 1}`}>Next</Link>}
    </div>
  </main>;
}
