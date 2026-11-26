import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import styles from './CollectionPageChrome.module.css';

export function CollectionPageFrame({ lang, children }) {
  return <main className={styles.page}>
    <Header lang={lang} />
    <div className={styles.shell}>{children}</div>
  </main>;
}

export function CollectionHero({ eyebrow, title, description, actions }) {
  return <header className={styles.hero}>
    <div className={styles.heroCopy}>
      <span className={styles.eyebrow}><span className={styles.eyebrowLine} />{eyebrow}</span>
      <h1>{title}<span className={styles.titleDot}>.</span></h1>
      <p>{description}</p>
    </div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>;
}

export function CollectionSecondaryAction({ href, children }) {
  return <Link className={styles.secondaryAction} href={href}>
    {children}<ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" />
  </Link>;
}

export function CollectionSectionHeading({ id, index, title, count }) {
  return <div className={styles.sectionHeading}>
    <div>
      <span className={styles.sectionIndex}>01 / {index}</span>
      <h2 id={id}>{title}</h2>
    </div>
    <span className={styles.count}>{count}</span>
  </div>;
}
