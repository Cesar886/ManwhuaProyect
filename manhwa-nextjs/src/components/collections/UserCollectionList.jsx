import Link from 'next/link';
import Header from '@/components/Header';
import ManhwaCover from '@/components/ManhwaCover';
import { collectionPath } from '@/lib/collections/server';
import styles from './SharedCollection.module.css';

export default function UserCollectionList({ username, collections, pagination, lang = 'es' }) {
  const en = lang === 'en';
  const base = `${en ? '/en' : ''}/u/${encodeURIComponent(username)}/${en ? 'collections' : 'colecciones'}`;
  return <main className={styles.page}>
    <Header lang={lang} />
    <div className={styles.container}>
      <h1>{en ? `Collections by @${username}` : `Colecciones de @${username}`}</h1>
      <div className={styles.grid}>{collections.map(c => <article className={styles.card} key={c.publicId}>
        <Link href={collectionPath(c, lang)}>
          <div className={styles.cover}><ManhwaCover src={c.coverUrl || c.previewSeries?.[0]} alt={c.name} /></div>
          <strong>{c.name}</strong>
          <span>{c.manhwasCount} {en ? 'titles' : 'obras'}</span>
        </Link>
      </article>)}</div>
      {!collections.length && <p>{en ? 'No public collections yet.' : 'Aún no hay colecciones públicas.'}</p>}
      {pagination?.page > 1 && <Link href={`${base}?page=${pagination.page - 1}`}>{en ? 'Previous' : 'Anterior'}</Link>}
      {pagination?.page < pagination?.pages && <Link href={`${base}?page=${pagination.page + 1}`}>{en ? 'Next' : 'Siguiente'}</Link>}
    </div>
  </main>;
}
