import Link from 'next/link';
import styles from './offline.module.css';

export const metadata = {
  title: 'Sin conexión | Manhwa Imperial',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>MANHWA IMPERIAL</p>
        <h1>Estás sin conexión</h1>
        <p>Conéctate a internet para cargar contenido nuevo. Los capítulos solo se pueden leer con conexión.</p>
        <Link className={styles.home} href="/home">Volver al inicio</Link>
      </div>
    </main>
  );
}
