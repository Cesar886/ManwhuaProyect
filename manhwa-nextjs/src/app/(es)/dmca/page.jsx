import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SITE_URL, SITE_NAME } from '@/config'
import styles from './Dmca.module.css'

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/dmca#webpage`,
    name: 'Política DMCA - Manhwa Imperial',
    description:
        'Política de cumplimiento DMCA. Procedimiento de notificación y eliminación de contenido por derechos de autor.',
    url: `${SITE_URL}/dmca`,
    inLanguage: 'es',
    isPartOf: {
        '@id': `${SITE_URL}/#website`,
    },
    about: {
        '@type': 'Thing',
        name: 'Digital Millennium Copyright Act Compliance',
    },
    publisher: {
        '@id': `${SITE_URL}/#organization`,
    },
}

export default function DMCAPage() {
    return (
        <>
            <Header />
            <main className={styles.pageWrapper}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />

                <div className={styles.content}>
                    {/* ── Hero ───────────────────────────────────────────────────── */}
                    <header className={styles.hero}>
                        <span className={styles.badge}>⚖️ Aviso legal</span>
                        <h1 className={styles.heroTitle}>Política DMCA</h1>
                        <div className={styles.heroMeta}>
                            <span className={styles.lastUpdated}>Última actualización: Febrero 2026</span>
                            <span className={styles.responseTime}>✓ Respuesta en 24–48 h</span>
                        </div>
                    </header>

                    {/* ── Agente DMCA ────────────────────────────────────────────── */}
                    <div className={styles.contactCard}>
                        <h2 className={styles.contactCardTitle}>
                            <span>📬</span> Agente DMCA Designado
                        </h2>
                        <div className={styles.contactRow}>
                            <span className={styles.contactLabel}>Correo electrónico</span>
                            <a href="mailto:dmca@manhwaimperial.site" className={styles.contactEmail}>
                                dmca@manhwaimperial.site
                            </a>
                            <span className={styles.subjectHint}>
                                Asunto recomendado: <strong>DMCA Takedown Notice – [Nombre de la obra]</strong>
                            </span>
                        </div>
                    </div>

                    {/* ── Secciones ─────────────────────────────────────────────── */}
                    <div className={styles.sections}>

                        {/* 1. Compromiso */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>1</span>
                                <h2 className={styles.sectionTitle}>Compromiso con los Derechos de Autor</h2>
                            </div>
                            <p className={styles.sectionText}>
                                {SITE_NAME} respeta la propiedad intelectual de terceros y cumple con las
                                disposiciones de la{' '}
                                <span className={styles.highlight}>
                                    Digital Millennium Copyright Act (DMCA), Título 17, Código de los Estados Unidos,
                                    Sección 512
                                </span>
                                . Mantenemos un sistema activo de notificación y eliminación{' '}
                                <em>(Notice and Takedown)</em> para atender las reclamaciones legítimas de
                                titulares de derechos de autor.
                            </p>
                        </section>

                        {/* 2. Procedimiento Takedown */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>2</span>
                                <h2 className={styles.sectionTitle}>
                                    Procedimiento de Notificación (Takedown Notice)
                                </h2>
                            </div>
                            <p className={styles.sectionText}>
                                Si usted es titular de derechos de autor, o un agente autorizado, y cree que
                                contenido alojado en o enlazado desde {SITE_NAME} infringe sus derechos de autor,
                                puede enviar una notificación DMCA a nuestro agente designado incluyendo:
                            </p>
                            <ol className={styles.sectionList}>
                                <li>
                                    Identificación de la obra protegida por derechos de autor que se alega infringida.
                                </li>
                                <li>
                                    Identificación del material que se alega infractor, incluyendo la{' '}
                                    <span className={styles.highlight}>URL específica</span> donde se encuentra.
                                </li>
                                <li>
                                    Información de contacto del reclamante: nombre completo, dirección, teléfono y
                                    correo electrónico.
                                </li>
                                <li>
                                    Declaración de{' '}
                                    <span className={styles.highlight}>buena fe</span> de que el uso del material no
                                    está autorizado por el titular de los derechos, su agente, o la ley.
                                </li>
                                <li>
                                    Declaración, bajo{' '}
                                    <span className={styles.highlight}>pena de perjurio</span>, de que la información
                                    en la notificación es exacta y que usted es el titular de los derechos o está
                                    autorizado para actuar en su nombre.
                                </li>
                                <li>
                                    Firma física o electrónica del titular de los derechos o de la persona autorizada
                                    para actuar en su nombre.
                                </li>
                            </ol>
                        </section>

                        {/* 3. Tiempo de respuesta */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>3</span>
                                <h2 className={styles.sectionTitle}>Tiempo de Respuesta</h2>
                            </div>
                            <div className={styles.infoBox}>
                                <p>
                                    Las solicitudes de eliminación legítimas y completas se procesan en un plazo de{' '}
                                    <strong>24 a 48 horas hábiles</strong> desde su recepción. Se enviará confirmación
                                    al reclamante una vez procesada la solicitud.
                                </p>
                            </div>
                        </section>

                        {/* 4. Contra-Notificación */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>4</span>
                                <h2 className={styles.sectionTitle}>Contra-Notificación (Counter Notice)</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Si usted cree que el contenido eliminado no infringe derechos de autor, o que tiene
                                autorización del titular para publicarlo, puede enviar una contra-notificación que
                                incluya:
                            </p>
                            <ol className={styles.sectionList}>
                                <li>Identificación del material eliminado y su ubicación anterior.</li>
                                <li>
                                    Declaración bajo <span className={styles.highlight}>pena de perjurio</span> de que
                                    el material fue eliminado por error o identificación incorrecta.
                                </li>
                                <li>
                                    Su nombre, dirección, teléfono y declaración de que acepta la jurisdicción del
                                    tribunal federal de su distrito.
                                </li>
                                <li>Su firma física o electrónica.</li>
                            </ol>
                        </section>

                        {/* 5. Infractores Reincidentes */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>5</span>
                                <h2 className={styles.sectionTitle}>Política de Infractores Reincidentes</h2>
                            </div>
                            <p className={styles.sectionText}>
                                {SITE_NAME} tiene una política de{' '}
                                <span className={styles.highlight}>terminación de cuentas</span> de usuarios que
                                sean infractores reincidentes de derechos de autor, de acuerdo con la DMCA.
                            </p>
                        </section>

                        {/* 6. Contenido Oficial */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>6</span>
                                <h2 className={styles.sectionTitle}>Promoción de Contenido Oficial</h2>
                            </div>
                            <p className={styles.sectionText}>
                                {SITE_NAME} promueve activamente que los usuarios apoyen a los creadores originales
                                comprando las obras oficiales en plataformas como{' '}
                                <span className={styles.highlight}>
                                    Webtoon, Tappytoon, Lezhin Comics
                                </span>{' '}
                                y otras. Cuando están disponibles, incluimos enlaces a dichas plataformas en las
                                páginas de cada serie.
                            </p>
                        </section>
                    </div>

                    {/* ── Links relacionados ─────────────────────────────────────── */}
                    <nav className={styles.footerLinks} aria-label="Páginas legales relacionadas">
                        <span className={styles.footerLinksTitle}>Páginas legales</span>
                        <div className={styles.footerLinksList}>
                            <Link href="/terminos-de-servicio" className={styles.footerLink}>
                                Términos de Servicio
                            </Link>
                            <Link href="/politica-de-privacidad" className={styles.footerLink}>
                                Política de Privacidad
                            </Link>
                            <Link href="/aviso-legal" className={styles.footerLink}>
                                Aviso Legal
                            </Link>
                            <Link href="/" className={styles.footerLink}>
                                ← Volver al inicio
                            </Link>
                        </div>
                    </nav>
                </div>
            </main>
            <Footer />
        </>
    )
}
