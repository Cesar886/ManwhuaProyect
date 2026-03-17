"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IconBrandInstagram,
  IconBrandTwitter,
  IconBrandDiscord,
  IconChevronDown,
  IconBrandFacebook,
} from '@tabler/icons-react';
import classes from './Footer.module.css';

const navColumns = [
  {
    title: 'Leer Manhwa',
    links: [
      { label: 'Biblioteca', link: '/biblioteca' },
      { label: 'Populares', link: '/populares' },
      { label: 'Colecciones', link: '/colecciones' },
    ],
  },
  {
    title: 'Géneros',
    links: [
      { label: 'Romance', link: '/genero/romance' },
      { label: 'Acción', link: '/genero/accion' },
      { label: 'Fantasía', link: '/genero/fantasia' },
    ],
  },
  {
    // SEO: Anchor text descriptivo — cada link debe tener URL diferente o texto único
    title: 'Blog',
    links: [
      { label: 'Artículos sobre Manhwa', link: '/blog' },
      { label: 'Guías para leer Manhwa', link: '/blog#guias' },
      { label: 'Comparativas de plataformas', link: '/blog#comparativas' },
    ],
  },
  {
    title: 'Comunidad',
    links: [
      { label : 'X/ Twitter', link: 'https://x.com/manhwaimperial' },
      { label: 'Instagram', link: 'https://instagram.com/manhwaimperial' },
      { label: 'Facebook', link: 'https://www.facebook.com/share/1DeCq4G8B4/' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Acerca de', link: '/acerca-de' },
      { label: 'Términos de Servicio', link: '/terminos-de-servicio' },
      { label: 'Privacidad', link: '/politica-de-privacidad' },
      { label: 'DMCA', link: '/dmca' },
      { label: 'Aviso Legal', link: '/aviso-legal' },
    ],
  },
];

const socialLinks = [
  { icon: IconBrandTwitter, label: 'Twitter', href: 'https://x.com/manhwaimperial' },
  { icon: IconBrandFacebook, label: 'Facebook', href: 'https://www.facebook.com/share/1DeCq4G8B4/' },
  { icon: IconBrandInstagram, label: 'Instagram', href: 'https://instagram.com/manhwaimperial' },
];

// Columna colapsable para mobile
function FooterColumn({ title, links }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={classes.wrapper}>
      <button
        className={classes.colTitle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        type="button"
      >
        <span>{title}</span>
        <IconChevronDown
          size={14}
          className={`${classes.chevron} ${open ? classes.chevronOpen : ''}`}
        />
      </button>
      <div className={`${classes.linksContainer} ${open ? classes.linksOpen : ''}`}>
        <div className={classes.linksInner}>
          {links.map((link, i) => (
            <Link key={i} href={link.link} className={classes.link}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={classes.footer}>
      {/* Línea decorativa superior */}
      <div className={classes.topLine} aria-hidden="true" />

      {/* ── Sección superior ── */}
      <section className={classes.topSection}>
        <div className={classes.container}>
          <div className={classes.inner}>

            {/* Branding */}
            <div className={classes.logoWrapper}>
              <Link href="/" className={classes.logoLink} aria-label="Manhwa Imperial - Inicio">
                <Image
                  src="/logo.png"
                  alt="Logo Manhwa Imperial"
                  width={36}
                  height={36}
                  className={classes.logoImg}
                />
                <span className={classes.logoName}>Manhwa Imperial</span>
              </Link>

              <p className={classes.description}>
                Tu biblioteca para leer manhwa y webtoons en español, gratis y de forma legal.
              </p>

              {/* Stats rápidas */}
              <div className={classes.stats}>
                <div className={classes.stat}>
                  <span className={classes.statNum}>500+</span>
                  <span className={classes.statLabel}>Manhwas</span>
                </div>
                <div className={classes.statDivider} aria-hidden="true" />
                <div className={classes.stat}>
                  <span className={classes.statNum}>Gratis</span>
                  <span className={classes.statLabel}>Siempre</span>
                </div>
                <div className={classes.statDivider} aria-hidden="true" />
                <div className={classes.stat}>
                  <span className={classes.statNum}>Legal</span>
                  <span className={classes.statLabel}>DMCA OK</span>
                </div>
              </div>

              {/* Redes sociales - visible en desktop junto al logo */}
              <div className={classes.socialDesktop}>
                {socialLinks.map(({ icon: Icon, label, href }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    className={classes.socialBtn}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon size={16} stroke={1.5} />
                  </a>
                ))}
              </div>
            </div>

            {/* Columnas de navegación — desktop: grid, mobile: acordeón */}
            <nav className={classes.groups} aria-label="Navegación del footer">
              {navColumns.map((col) => (
                <FooterColumn key={col.title} title={col.title} links={col.links} />
              ))}
            </nav>
          </div>
        </div>
      </section>

      {/* ── Divisor ── */}
      <div className={classes.divider} role="separator" />

      {/* ── Disclaimer Legal ── */}
      <div className={classes.disclaimer}>
        <div className={classes.container}>
          <nav aria-label="Política del sitio" className={classes.disclaimerLinks}>
            <Link href="/terminos-de-servicio" className={classes.disclaimerLink}>Términos</Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href="/politica-de-privacidad" className={classes.disclaimerLink}>Privacidad</Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href="/dmca" className={classes.disclaimerLink}>DMCA</Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href="/aviso-legal" className={classes.disclaimerLink}>Aviso Legal</Link>
          </nav>
          <p className={classes.disclaimerText}>
            © {year} Manhwa Imperial. Todos los manhwas, webtoons y manhua son propiedad de
            sus respectivos autores y editores. Plataforma de agregación con{' '}
            <Link href="/dmca" className={classes.disclaimerHighlight}>cumplimiento DMCA activo</Link>.
            {' '}Libre de malware, sin anuncios intrusivos.
          </p>
        </div>
      </div>

      {/* ── Fila final: copyright + social mobile ── */}
      <div className={classes.afterFooter}>
        <div className={classes.container}>
          <div className={classes.afterFooterInner}>
            <p className={classes.copyright}>
              © {year} Manhwa Imperial — Hecho con{' '}
              <span className={classes.heart} aria-label="amor">♥</span>
              {' '}para lectores
            </p>

            {/* Social visible solo en mobile (en desktop está arriba) */}
            <div className={classes.socialMobile}>
              {socialLinks.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className={classes.socialBtn}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon size={16} stroke={1.5} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default React.memo(Footer);
