'use client';

import React from 'react';
import styles from './Pendiente.module.css';

const featured = [
  {
    id: 's1',
    title: 'Amanecer Rojo',
    author: 'Jin Lee',
    short: 'Una aventura sobrenatural con ritmo cinematográfico y arte cuidado.',
  },
  {
    id: 's2',
    title: 'Callejón de los Sueños',
    author: 'Park Min',
    short: 'Narrativa íntima sobre amistades complejas y segundas oportunidades.',
  },
  {
    id: 's3',
    title: 'Cazadores de Estrellas',
    author: 'Studio Nova',
    short: 'Sci‑fi épica con diseño visual sobresaliente y personajes memorables.',
  },
];

export default function Pendiente() {
  return (
    <main className={styles.page}>
      <header className={styles.hero} role="banner">
        <div className={styles.heroContent}>
          <h1 className={styles.title}>Manhwa Imperial — Tu biblioteca de manhwas</h1>
          <p className={styles.lead}>
            Descubre colecciones, sigue series en crecimiento y
            organiza tu biblioteca personal. Creado para lectores exigentes y comunidades creativas.
          </p>

          <ul className={styles.ctaRow}>
            <li>
              <a className={styles.ctaPrimary} href="#colecciones">Explorar colecciones</a>
            </li>
            <li>
              <a className={styles.ctaOutline} href="#biblioteca">Ir a mi biblioteca</a>
            </li>
          </ul>

          <div className={styles.metrics} aria-hidden="true">
            <div>
              <strong>1.2k+</strong>
              <span>Series</span>
            </div>
            <div>
              <strong>50k+</strong>
              <span>Capítulos</span>
            </div>
            <div>
              <strong>200k+</strong>
              <span>Lectores</span>
            </div>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.visualMock}>
            <span className={styles.visualLabel}>Portada destacada</span>
          </div>
        </div>
      </header>

      <section id="colecciones" className={styles.features} aria-labelledby="featuresTitle">
        <h2 id="featuresTitle" className={styles.sectionTitle}>Qué ofrecemos</h2>
        <div className={styles.featureGrid}>
          <article className={styles.feature}>
            <h3>Catálogo curado</h3>
            <p>Selecciones hechas por editores y fans para destacar historias únicas.</p>
          </article>
          <article className={styles.feature}>
            <h3>Biblioteca personal</h3>
            <p>Guarda, organiza y retoma lecturas donde las dejaste.</p>
          </article>
          <article className={styles.feature}>
            <h3>Recomendaciones</h3>
            <p>Listas populares y sugerencias basadas en tus lecturas.</p>
          </article>
        </div>
      </section>

      <section className={styles.gallery} aria-labelledby="destacadosTitle">
        <h2 id="destacadosTitle" className={styles.sectionTitle}>Destacados</h2>
        <div className={styles.grid}>
          {featured.map((s) => (
            <article key={s.id} className={styles.card} aria-label={`Serie ${s.title}`}>
              <div className={styles.cardThumb} />
              <div className={styles.cardBody}>
                <h3 className={styles.cardTitle}>{s.title}</h3>
                <p className={styles.cardAuthor}>{s.author}</p>
                <p className={styles.cardShort}>{s.short}</p>
                <div className={styles.cardActions}>
                  <button className={styles.link}>Ver serie</button>
                  <button className={styles.link}>Agregar</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className={styles.newsletter} aria-labelledby="newsletterTitle">
        <h2 id="newsletterTitle">Suscríbete para novedades</h2>
        <p>Recibe recomendaciones y lanzamientos destacados en tu correo.</p>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <label className={styles.srOnly} htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" placeholder="tu@correo.com" required className={styles.input} />
          <button className={styles.btn}>Suscribirse</button>
        </form>
      </aside>

      <footer className={styles.note}>
        <small>Portada de ejemplo — adapta textos e imágenes a tu contenido real.</small>
      </footer>
    </main>
  );
}