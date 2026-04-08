import Link from 'next/link'
import Header from '@/components/Header'
import { SITE_URL } from '@/config'
import styles from '@/styles/legal.module.css'

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/politica-de-privacidad#webpage`,
    name: 'Política de Privacidad - Manhwa Imperial',
    url: `${SITE_URL}/politica-de-privacidad`,
    description: 'Política de privacidad y protección de datos personales de Manhwa Imperial.',
    inLanguage: 'es',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
}

export default function PrivacidadPage() {
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
                        <span className={styles.badge}>🔒 Privacidad</span>
                        <h1 className={styles.heroTitle}>Política de Privacidad</h1>
                        <div className={styles.heroMeta}>
                            <span className={styles.metaTag}>
                                <strong>Última actualización:</strong> Febrero 2026
                            </span>
                        </div>
                    </header>

                    <div className={styles.body}>
                        {/* 1. Información que recopilamos */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>1</span>
                                <h2 className={styles.sectionTitle}>Información que Recopilamos</h2>
                            </div>

                            <h3 className={styles.subTitle}>1.1 Información proporcionada voluntariamente</h3>
                            <ul className={styles.sectionList}>
                                <li>
                                    Nombre de usuario y correo electrónico (solo al registrarse, que es{' '}
                                    <span className={styles.highlight}>opcional</span>)
                                </li>
                                <li>Comentarios y calificaciones publicados</li>
                                <li>Solicitudes de la comunidad</li>
                            </ul>

                            <h3 className={styles.subTitle}>1.2 Información recopilada automáticamente</h3>
                            <ul className={styles.sectionList}>
                                <li>Dirección IP (para seguridad y prevención de abuso)</li>
                                <li>Tipo de navegador y dispositivo</li>
                                <li>Páginas visitadas y tiempo de permanencia</li>
                                <li>Cookies esenciales para el funcionamiento del sitio</li>
                            </ul>
                        </section>

                        {/* 2. Cómo usamos la información */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>2</span>
                                <h2 className={styles.sectionTitle}>Cómo Usamos su Información</h2>
                            </div>
                            <ul className={styles.sectionList}>
                                <li>Proporcionar y mejorar el servicio de la Plataforma</li>
                                <li>Personalizar la experiencia del usuario (historial, favoritos)</li>
                                <li>Prevenir abuso y garantizar la seguridad de la plataforma</li>
                                <li>Comunicaciones relacionadas con el servicio (si el usuario lo solicita)</li>
                                <li>Análisis agregados y anónimos para mejorar la plataforma</li>
                            </ul>
                        </section>

                        {/* 3. Compartición de datos */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>3</span>
                                <h2 className={styles.sectionTitle}>Compartición de Datos</h2>
                            </div>
                            <div className={styles.infoBox}>
                                <p>
                                    Manhwa Imperial <strong>no vende, alquila ni comparte</strong> información
                                    personal con terceros, excepto en los siguientes casos:
                                </p>
                            </div>
                            <ul className={styles.sectionList}>
                                <li>Cuando sea requerido por ley o proceso legal válido</li>
                                <li>
                                    Para proteger los derechos, propiedad o seguridad de la Plataforma o sus usuarios
                                </li>
                                <li>
                                    Con proveedores de servicios que nos asisten en la operación (hosting, analytics),
                                    bajo acuerdos de confidencialidad
                                </li>
                            </ul>
                        </section>

                        {/* 4. Cookies */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>4</span>
                                <h2 className={styles.sectionTitle}>Cookies</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Utilizamos cookies esenciales para el funcionamiento básico del sitio y cookies
                                analíticas para comprender el uso de la plataforma. Puede configurar su navegador
                                para rechazar cookies, aunque esto puede afectar algunas funcionalidades.
                            </p>
                        </section>

                        {/* 5. Seguridad */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>5</span>
                                <h2 className={styles.sectionTitle}>Seguridad</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Implementamos medidas de seguridad técnicas y organizativas para proteger su
                                información, incluyendo{' '}
                                <span className={styles.highlight}>
                                    cifrado HTTPS, acceso restringido a datos, y monitoreo de seguridad
                                </span>
                                .
                            </p>
                        </section>

                        {/* 6. Derechos del usuario */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>6</span>
                                <h2 className={styles.sectionTitle}>Derechos del Usuario</h2>
                            </div>
                            <p className={styles.sectionText}>Usted tiene derecho a:</p>
                            <ul className={styles.sectionList}>
                                <li>Acceder a su información personal</li>
                                <li>Solicitar la corrección de datos inexactos</li>
                                <li>Solicitar la eliminación de su cuenta y datos asociados</li>
                                <li>Oponerse al procesamiento de sus datos</li>
                            </ul>
                            <p className={styles.sectionText}>
                                Para ejercer estos derechos, contacte a{' '}
                                <a href="mailto:contacto@manhwaimperial.site" className={styles.contactEmail}>
                                    contacto@manhwaimperial.site
                                </a>
                            </p>
                        </section>

                        {/* 7. Menores de edad */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>7</span>
                                <h2 className={styles.sectionTitle}>Menores de Edad</h2>
                            </div>
                            <p className={styles.sectionText}>
                                No recopilamos intencionalmente información de{' '}
                                <span className={styles.highlight}>menores de 13 años</span>. Si detectamos que
                                un menor ha proporcionado datos personales, los eliminaremos.
                            </p>
                        </section>

                        {/* 8. Cambios */}
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>8</span>
                                <h2 className={styles.sectionTitle}>Cambios en esta Política</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Podemos actualizar esta política periódicamente. Los cambios se publicarán en esta
                                página con la fecha de actualización.
                            </p>
                        </section>
                    </div>

                    {/* Contacto */}
                    <div className={styles.contactBox}>
                        <p className={styles.contactBoxTitle}>Contacto sobre privacidad</p>
                        <a href="mailto:contacto@manhwaimperial.site" className={styles.contactEmail}>
                            contacto@manhwaimperial.site
                        </a>
                    </div>

                    {/* Links */}
                    <nav className={styles.footerLinks} aria-label="Páginas legales relacionadas">
                        <span className={styles.footerLinksTitle}>Páginas legales</span>
                        <div className={styles.footerLinksList}>
                            <Link href="/terminos-de-servicio" className={styles.footerLink}>
                                Términos de Servicio
                            </Link>
                            <Link href="/dmca" className={styles.footerLink}>
                                Política DMCA
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
        </>
    )
}
