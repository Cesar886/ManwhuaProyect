import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SITE_URL, SITE_NAME } from '@/config'
import styles from '@/styles/legal.module.css'

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/aviso-legal#webpage`,
    name: 'Aviso Legal - Manhwa Imperial',
    url: `${SITE_URL}/aviso-legal`,
    description: 'Aviso legal y descargo de responsabilidad de Manhwa Imperial.',
    inLanguage: 'es',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
}

export default function AvisoLegalPage() {
    return (
        <>
            <Header />
            <main className={styles.pageWrapper}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />

                <div className={styles.content}>
                    {/* Hero */}
                    <header className={styles.hero}>
                        <span className={styles.badge}>⚖️ Aviso</span>
                        <h1 className={styles.heroTitle}>Aviso Legal</h1>
                        <div className={styles.heroMeta}>
                            <span className={styles.metaTag}>
                                <strong>Última actualización:</strong> Febrero 2026
                            </span>
                        </div>
                    </header>

                    <div className={styles.body}>
                        {/* Naturaleza del servicio */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>1</span>
                                <h2 className={styles.sectionTitle}>Naturaleza del Servicio</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Manhwa Imperial opera como una{' '}
                                <span className={styles.highlight}>plataforma de agregación de contenido</span> que
                                indexa y organiza manhwas, webtoons y manhua ya disponibles públicamente en
                                internet. No somos los creadores ni propietarios del contenido de los cómics
                                presentados.
                            </p>
                        </section>

                        {/* Derechos de Autor */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>2</span>
                                <h2 className={styles.sectionTitle}>Derechos de Autor</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Todo el contenido de manhwa, webtoon y manhua presentado en esta plataforma es
                                propiedad de sus respectivos{' '}
                                <span className={styles.highlight}>autores, artistas y editores</span>. Manhwa
                                Imperial reconoce y respeta estos derechos. El uso del contenido se realiza bajo el
                                marco de la Digital Millennium Copyright Act (DMCA), con un sistema activo de
                                notificación y eliminación.
                            </p>
                        </section>

                        {/* Apoyo a Creadores */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>3</span>
                                <h2 className={styles.sectionTitle}>Apoyo a Creadores</h2>
                            </div>
                            <div className={styles.infoBox}>
                                <p>
                                    {SITE_NAME} apoya activamente a los creadores originales y anima a todos los
                                    usuarios a <strong>comprar las obras oficiales</strong> cuando estén disponibles.
                                    Proporcionamos enlaces a plataformas oficiales como Webtoon, Tappytoon y Lezhin
                                    Comics siempre que sea posible.
                                </p>
                            </div>
                        </section>

                        {/* Descargo de Responsabilidad */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>4</span>
                                <h2 className={styles.sectionTitle}>Descargo de Responsabilidad</h2>
                            </div>
                            <p className={styles.sectionText}>
                                El contenido se proporciona "tal cual" sin garantías de ningún tipo. Manhwa Imperial
                                no se hace responsable de la exactitud, integridad o actualidad del contenido
                                presentado. El uso de la plataforma es bajo la propia{' '}
                                <span className={styles.highlight}>responsabilidad del usuario</span>.
                            </p>
                        </section>

                        {/* Enlaces Externos */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>5</span>
                                <h2 className={styles.sectionTitle}>Enlaces Externos</h2>
                            </div>
                            <p className={styles.sectionText}>
                                La Plataforma puede contener enlaces a sitios web de terceros. No somos
                                responsables del contenido, políticas de privacidad o prácticas de sitios externos.
                            </p>
                        </section>
                    </div>

                    {/* Contacto legal */}
                    <div className={styles.contactBox}>
                        <p className={styles.contactBoxTitle}>Contacto Legal</p>
                        <p className={styles.sectionText} style={{ marginBottom: '6px' }}>
                            Asuntos generales:
                        </p>
                        <a href="mailto:contacto@manhwaimperial.site" className={styles.contactEmail}>
                            contacto@manhwaimperial.site
                        </a>
                        <p className={styles.sectionText} style={{ marginTop: '10px', marginBottom: '6px' }}>
                            Reclamaciones DMCA:
                        </p>
                        <a href="mailto:dmca@manhwaimperial.site" className={styles.contactEmail}>
                            dmca@manhwaimperial.site
                        </a>
                    </div>

                    {/* Links */}
                    <nav className={styles.footerLinks} aria-label="Páginas legales relacionadas">
                        <span className={styles.footerLinksTitle}>Páginas legales</span>
                        <div className={styles.footerLinksList}>
                            <Link href="/terminos-de-servicio" className={styles.footerLink}>
                                Términos de Servicio
                            </Link>
                            <Link href="/politica-de-privacidad" className={styles.footerLink}>
                                Política de Privacidad
                            </Link>
                            <Link href="/dmca" className={styles.footerLink}>
                                Política DMCA
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
