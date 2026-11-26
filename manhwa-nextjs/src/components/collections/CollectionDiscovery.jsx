import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, Heart, Plus } from 'lucide-react';
import ManhwaCover from '@/components/ManhwaCover';
import { collectionPath } from '@/lib/collections/server';
import { CollectionPageFrame, CollectionHero, CollectionSecondaryAction, CollectionSectionHeading } from './CollectionPageChrome';
import styles from './CollectionDiscovery.module.css';

const copy = {
  es: {
    eyebrow: 'La biblioteca de la comunidad',
    title: 'Colecciones públicas',
    intro: 'Historias reunidas por lectores. Explora nuevas perspectivas, guarda tus favoritas y crea una selección propia.',
    myCollections: 'Mis colecciones',
    section: 'Explorar colecciones',
    collection: 'colección',
    collections: 'colecciones',
    works: 'obras',
    likes: 'me gusta',
    emptyEyebrow: 'Todavía hay espacio para la primera',
    emptyTitle: 'Las mejores listas empiezan con una historia.',
    emptyText: 'Cuando alguien comparta una colección pública, aparecerá aquí. Puedes empezar creando la tuya.',
    emptyAction: 'Crear mi colección',
    previous: 'Anterior',
    next: 'Siguiente',
  },
  en: {
    eyebrow: 'The community library',
    title: 'Public collections',
    intro: 'Stories gathered by readers. Explore fresh perspectives, save your favorites, and build a selection of your own.',
    myCollections: 'My collections',
    section: 'Explore collections',
    collection: 'collection',
    collections: 'collections',
    works: 'titles',
    likes: 'likes',
    emptyEyebrow: 'Room for the first collection',
    emptyTitle: 'Every great list starts with a story.',
    emptyText: 'Public collections shared by readers will appear here. You can start by creating your own.',
    emptyAction: 'Create my collection',
    previous: 'Previous',
    next: 'Next',
  },
};

export default function CollectionDiscovery({ lang = 'es', collections = [], pagination }) {
  const t = copy[lang] || copy.es;
  const myPath = lang === 'en' ? '/en/my-collections' : '/mis-colecciones';
  const listPath = lang === 'en' ? '/en/collections' : '/colecciones';
  const count = collections.length;
  const totalCount = pagination?.total ?? count;

  return (
    <CollectionPageFrame lang={lang}>
        <CollectionHero eyebrow={t.eyebrow} title={t.title} description={t.intro}
          actions={<CollectionSecondaryAction href={myPath}>{t.myCollections}</CollectionSecondaryAction>} />

        <section aria-labelledby="collections-heading">
          <CollectionSectionHeading id="collections-heading" index={t.section} title={t.section}
            count={`${totalCount} ${totalCount === 1 ? t.collection : t.collections}`} />

          {count > 0 ? (
            <div className={styles.grid}>
              {collections.map((collection, index) => {
                const username = collection.creator?.username;
                const href = collection.type === 'favorites'
                  ? `${lang === 'en' ? '/en' : ''}/u/${encodeURIComponent(username)}/${lang === 'en' ? 'favorites' : 'favoritos'}`
                  : collectionPath(collection, lang);
                const preview = collection.previewSeries || [];

                return (
                  <article className={styles.card} key={collection.publicId}>
                    <Link href={href} className={styles.cardLink}>
                      <div className={styles.artwork}>
                        <span className={styles.artworkIndex}>{String(index + 1 + ((pagination?.page || 1) - 1) * (pagination?.limit || 12)).padStart(2, '0')}</span>
                        <div className={styles.coverBack} aria-hidden="true">
                          {preview[1] && <ManhwaCover src={preview[1]} alt="" />}
                        </div>
                        <div className={styles.coverFront}>
                          <ManhwaCover src={collection.coverUrl || preview[0]} alt={collection.name} />
                        </div>
                        <span className={styles.openIcon}><ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" /></span>
                      </div>
                      <div className={styles.cardBody}>
                        <span className={styles.creator}>@{username}</span>
                        <h3>{collection.name}</h3>
                        <div className={styles.cardMeta}>
                          <span><BookOpen size={14} strokeWidth={1.8} aria-hidden="true" />{collection.manhwasCount} {t.works}</span>
                          <span><Heart size={14} strokeWidth={1.8} aria-hidden="true" />{collection.likesCount} {t.likes}</span>
                        </div>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.empty}>
              <div className={styles.emptyArt} aria-hidden="true">
                <span className={styles.emptyCoverBack} />
                <span className={styles.emptyCoverMiddle} />
                <span className={styles.emptyCoverFront}><BookOpen size={38} strokeWidth={1.1} /></span>
                <span className={styles.emptySparkle}>✦</span>
              </div>
              <div className={styles.emptyCopy}>
                <span className={styles.emptyEyebrow}>{t.emptyEyebrow}</span>
                <h3>{t.emptyTitle}</h3>
                <p>{t.emptyText}</p>
                <Link className={styles.createLink} href={myPath}>
                  <Plus size={17} strokeWidth={1.8} aria-hidden="true" />{t.emptyAction}<ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}

          {pagination?.pages > 1 && (
            <nav className={styles.pagination} aria-label={lang === 'en' ? 'Collection pages' : 'Páginas de colecciones'}>
              {pagination.page > 1 ? <Link href={`${listPath}?page=${pagination.page - 1}`}>← {t.previous}</Link> : <span />}
              <span>{pagination.page} / {pagination.pages}</span>
              {pagination.page < pagination.pages ? <Link href={`${listPath}?page=${pagination.page + 1}`}>{t.next} →</Link> : <span />}
            </nav>
          )}
        </section>
    </CollectionPageFrame>
  );
}
