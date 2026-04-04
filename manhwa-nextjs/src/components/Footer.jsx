"use client";

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  IconBrandInstagram,
  IconBrandTwitter,
  IconChevronDown,
  IconBrandFacebook,
} from '@tabler/icons-react';
import { useLang } from '../hooks/useLang';
import { getLocalizedPath } from '../utils/i18nRoutes';
import classes from './Footer.module.css';

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

function Footer({ lang: propLang }) {
  const year = new Date().getFullYear();
  const { lang: detectedLang } = useLang();
  const lang = propLang || detectedLang;
  
  // Columnas de navegación (dinámicas según idioma)
  const navColumns = useMemo(() => {
    if (lang === 'en') {
      return [
        {
          title: 'Read Manhwa',
          links: [
            { label: 'Library', link: getLocalizedPath('/library', lang) },
            { label: 'Popular', link: getLocalizedPath('/populares', lang) },
            { label: 'Collections', link: getLocalizedPath('/colecciones', lang) },
          ],
        },
        {
          title: 'Genres',
          links: [
            { label: 'Romance', link: getLocalizedPath('/genre/romance', lang) },
            { label: 'Action', link: getLocalizedPath('/genre/accion', lang) },
            { label: 'Fantasy', link: getLocalizedPath('/genre/fantasia', lang) },
          ],
        },
        {
          title: 'Blog',
          links: [
            { label: 'Manhwa Articles', link: '/blog' },
            { label: 'Reading Guides', link: '/blog#guides' },
            { label: 'Platform Comparisons', link: '/blog#comparisons' },
          ],
        },
        {
          title: 'Community',
          links: [
            { label : 'X/ Twitter', link: 'https://x.com/manhwaimperial' },
            { label: 'Instagram', link: 'https://instagram.com/manhwaimperial' },
            { label: 'Facebook', link: 'https://www.facebook.com/share/1DeCq4G8B4/' },
          ],
        },
        {
          title: 'Legal',
          links: [
            { label: 'About', link: getLocalizedPath('/about', lang) },
            { label: 'Terms of Service', link: getLocalizedPath('/terms-of-service', lang) },
            { label: 'Privacy', link: getLocalizedPath('/privacy-policy', lang) },
            { label: 'DMCA', link: getLocalizedPath('/dmca', lang) },
            { label: 'Legal Notice', link: getLocalizedPath('/legal-notice', lang) },
          ],
        },
      ];
    }
    
    return [
      {
        title: 'Leer Manhwa',
        links: [
          { label: 'Biblioteca', link: getLocalizedPath('/biblioteca', lang) },
          { label: 'Populares', link: getLocalizedPath('/populares', lang) },
          { label: 'Colecciones', link: getLocalizedPath('/colecciones', lang) },
        ],
      },
      {
        title: 'Géneros',
        links: [
          { label: 'Romance', link: getLocalizedPath('/genero/romance', lang) },
          { label: 'Acción', link: getLocalizedPath('/genero/accion', lang) },
          { label: 'Fantasía', link: getLocalizedPath('/genero/fantasia', lang) },
        ],
      },
      {
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
          { label: 'Acerca de', link: getLocalizedPath('/acerca-de', lang) },
          { label: 'Términos de Servicio', link: getLocalizedPath('/terminos-de-servicio', lang) },
          { label: 'Privacidad', link: getLocalizedPath('/politica-de-privacidad', lang) },
          { label: 'DMCA', link: getLocalizedPath('/dmca', lang) },
          { label: 'Aviso Legal', link: getLocalizedPath('/aviso-legal', lang) },
        ],
      },
    ];
  }, [lang]);

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
              <Link
                href={getLocalizedPath('/home', lang)}
                className={classes.logoLink}
                aria-label={lang === 'en' ? 'Manhwa Imperial - Home' : 'Manhwa Imperial - Inicio'}
              >
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
                {lang === 'en' 
                  ? 'Your library to read manhwa and webtoons in English, free and legally.'
                  : 'Tu biblioteca para leer manhwa y webtoons en español, gratis y de forma legal.'}
              </p>

              {/* Stats rápidas */}
              <div className={classes.stats}>
                <div className={classes.stat}>
                  <span className={classes.statNum}>500+</span>
                  <span className={classes.statLabel}>Manhwas</span>
                </div>
                <div className={classes.statDivider} aria-hidden="true" />
                <div className={classes.stat}>
                  <span className={classes.statNum}>{lang === 'en' ? 'Free' : 'Gratis'}</span>
                  <span className={classes.statLabel}>{lang === 'en' ? 'Always' : 'Siempre'}</span>
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
            <nav className={classes.groups} aria-label={lang === 'en' ? 'Footer navigation' : 'Navegación del footer'}>
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
          <nav aria-label={lang === 'en' ? 'Site policy' : 'Política del sitio'} className={classes.disclaimerLinks}>
            <Link href={getLocalizedPath(lang === 'en' ? '/terms-of-service' : '/terminos-de-servicio', lang)} className={classes.disclaimerLink}>
              {lang === 'en' ? 'Terms' : 'Términos'}
            </Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href={getLocalizedPath(lang === 'en' ? '/privacy-policy' : '/politica-de-privacidad', lang)} className={classes.disclaimerLink}>
              {lang === 'en' ? 'Privacy' : 'Privacidad'}
            </Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href={getLocalizedPath('/dmca', lang)} className={classes.disclaimerLink}>DMCA</Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href={getLocalizedPath(lang === 'en' ? '/legal-notice' : '/aviso-legal', lang)} className={classes.disclaimerLink}>
              {lang === 'en' ? 'Legal Notice' : 'Aviso Legal'}
            </Link>
          </nav>
          <p className={classes.disclaimerText}>
            {lang === 'en' 
              ? <>© {year} Manhwa Imperial. All manhwas, webtoons and manhua are property of their respective authors and publishers. Aggregation platform with{' '}
                <Link href={getLocalizedPath('/dmca', lang)} className={classes.disclaimerHighlight}>active DMCA compliance</Link>.
                {' '}Malware-free, no intrusive ads.</>
              : <>© {year} Manhwa Imperial. Todos los manhwas, webtoons y manhua son propiedad de
                sus respectivos autores y editores. Plataforma de agregación con{' '}
                <Link href={getLocalizedPath('/dmca', lang)} className={classes.disclaimerHighlight}>cumplimiento DMCA activo</Link>.
                {' '}Libre de malware, sin anuncios intrusivos.</>
            }
          </p>
        </div>
      </div>

      {/* ── Fila final: copyright + social mobile ── */}
      <div className={classes.afterFooter}>
        <div className={classes.container}>
          <div className={classes.afterFooterInner}>
            <p className={classes.copyright}>
              {lang === 'en'
                ? <>© {year} Manhwa Imperial — Made with{' '}<span className={classes.heart} aria-label="love">♥</span>{' '}for readers</>
                : <>© {year} Manhwa Imperial — Hecho con{' '}<span className={classes.heart} aria-label="amor">♥</span>{' '}para lectores</>
              }
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
