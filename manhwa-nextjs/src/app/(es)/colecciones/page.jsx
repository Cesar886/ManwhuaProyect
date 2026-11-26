import Link from 'next/link';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import { collectionApi, collectionPath } from '@/lib/collections/server';
import styles from '@/components/collections/SharedCollection.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Colecciones públicas | Manhwa Imperial', robots: { index: false, follow: false } };

export default async function CollectionsPage({ searchParams }) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const data = await collectionApi(`collections?page=${currentPage}`);
  const collections = data?.collections || [];
  const pagination = data?.pagination;

  return <main className={styles.page}>
    <Header lang="es" />
    <div className={styles.container}>
      <h1>Colecciones públicas</h1>
      <p>Explora las listas que comparte la comunidad.</p>
      <p><Link href="/mis-colecciones">Mis colecciones</Link></p>
      <div className={styles.grid}>{collections.map(c => <article className={styles.card} key={c.publicId}>
        <Link href={c.type === 'favorites' ? `/u/${encodeURIComponent(c.creator.username)}/favoritos` : collectionPath(c)}>
          <div className={styles.cover}><ManhwaCover src={c.coverUrl || c.previewSeries?.[0]} alt={c.name} /></div>
          <strong>{c.name}</strong>
          <span>@{c.creator.username} · {c.manhwasCount} obras · {c.likesCount} likes</span>
        </Link>
      </article>)}</div>
      {!collections.length && <p>Aún no hay colecciones públicas.</p>}
      {pagination?.page > 1 && <Link href={`/colecciones?page=${pagination.page - 1}`}>Anterior</Link>}
      {pagination?.page < pagination.pages && <Link href={`/colecciones?page=${pagination.page + 1}`}>Siguiente</Link>}
    </div>
  </main>;
}
