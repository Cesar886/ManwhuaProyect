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
import { getTranslations } from '../i18n/translations';
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
  const t = getTranslations(lang).footer;
  const homeHref = getLocalizedPath('/', lang);

  // Columnas de navegación (dinámicas según idioma)
  const navColumns = useMemo(() => {
    const genreBase = lang === 'en' ? '/genre' : '/genero';
    return [
      {
        title: t.colReadManhwa,
        links: [
          { label: t.linkLibrary, link: getLocalizedPath(lang === 'en' ? '/library' : '/biblioteca', lang) },
          { label: t.linkPopular, link: getLocalizedPath('/populares', lang) },
          { label: t.linkCollections, link: getLocalizedPath('/colecciones', lang) },
        ],
      },
      {
        title: t.colGenres,
        links: [
          { label: t.linkRomance, link: getLocalizedPath(`${genreBase}/romance`, lang) },
          { label: t.linkAction, link: getLocalizedPath(`${genreBase}/accion`, lang) },
          { label: t.linkFantasy, link: getLocalizedPath(`${genreBase}/fantasia`, lang) },
        ],
      },
      {
        title: t.colBlog,
        links: [
          { label: t.linkBlogArticles, link: '/blog' },
          { label: t.linkBlogGuides, link: `/blog${t.blogGuidesHash}` },
          { label: t.linkBlogCompare, link: `/blog${t.blogCompareHash}` },
        ],
      },
      {
        title: t.colCommunity,
        links: [
          { label: 'X/ Twitter', link: 'https://x.com/manhwaimperial' },
          { label: 'Instagram', link: 'https://instagram.com/manhwaimperial' },
          { label: 'Facebook', link: 'https://www.facebook.com/share/1DeCq4G8B4/' },
        ],
      },
      {
        title: t.colLegal,
        links: [
          { label: t.linkAbout, link: getLocalizedPath(lang === 'en' ? '/about' : '/acerca-de', lang) },
          { label: t.linkTerms, link: getLocalizedPath(lang === 'en' ? '/terms-of-service' : '/terminos-de-servicio', lang) },
          { label: t.linkPrivacy, link: getLocalizedPath(lang === 'en' ? '/privacy-policy' : '/politica-de-privacidad', lang) },
          { label: t.linkDmca, link: getLocalizedPath('/dmca', lang) },
          { label: t.linkLegalNotice, link: getLocalizedPath(lang === 'en' ? '/legal-notice' : '/aviso-legal', lang) },
        ],
      },
    ];
  }, [lang, t]);

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
                href={homeHref}
                className={classes.logoLink}
                aria-label={t.homeAria}
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

              <p className={classes.description}>{t.description}</p>

              {/* Stats rápidas */}
              <div className={classes.stats}>
                <div className={classes.stat}>
                  <span className={classes.statNum}>500+</span>
                  <span className={classes.statLabel}>Manhwas</span>
                </div>
                <div className={classes.statDivider} aria-hidden="true" />
                <div className={classes.stat}>
                  <span className={classes.statNum}>{t.statFree}</span>
                  <span className={classes.statLabel}>{t.statAlways}</span>
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
            <nav className={classes.groups} aria-label={t.navAria}>
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
          <nav aria-label={t.policyAria} className={classes.disclaimerLinks}>
            <Link href={getLocalizedPath(lang === 'en' ? '/terms-of-service' : '/terminos-de-servicio', lang)} className={classes.disclaimerLink}>
              {t.termsShort}
            </Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href={getLocalizedPath(lang === 'en' ? '/privacy-policy' : '/politica-de-privacidad', lang)} className={classes.disclaimerLink}>
              {t.privacyShort}
            </Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href={getLocalizedPath('/dmca', lang)} className={classes.disclaimerLink}>DMCA</Link>
            <span className={classes.disclaimerSep} aria-hidden="true">·</span>
            <Link href={getLocalizedPath(lang === 'en' ? '/legal-notice' : '/aviso-legal', lang)} className={classes.disclaimerLink}>
              {t.legalNoticeShort}
            </Link>
          </nav>
          <p className={classes.disclaimerText}>
            © {year} Manhwa Imperial. {t.disclaimerLead}
            <Link href={getLocalizedPath('/dmca', lang)} className={classes.disclaimerHighlight}>{t.disclaimerDmcaLink}</Link>
            {t.disclaimerTail}
          </p>
        </div>
      </div>

      {/* ── Fila final: copyright + social mobile ── */}
      <div className={classes.afterFooter}>
        <div className={classes.container}>
          <div className={classes.afterFooterInner}>
            <p className={classes.copyright}>
              © {year} Manhwa Imperial — {t.madeWith}{' '}
              <span className={classes.heart} aria-label={t.loveAria}>♥</span>{' '}
              {t.forReaders}
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
