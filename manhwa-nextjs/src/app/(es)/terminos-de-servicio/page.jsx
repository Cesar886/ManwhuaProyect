import Link from 'next/link'
import Header from '@/components/Header'
import { SITE_URL, SITE_NAME } from '@/config'
import styles from '@/styles/legal.module.css'

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${SITE_URL}/terminos-de-servicio#webpage`,
    name: 'Términos de Servicio - Manhwa Imperial',
    url: `${SITE_URL}/terminos-de-servicio`,
    description: 'Términos y condiciones legales que rigen el uso de Manhwa Imperial.',
    inLanguage: 'es',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    publisher: { '@id': `${SITE_URL}/#organization` },
}

const sections = [
    {
        num: '1',
        title: 'Aceptación de los Términos',
        content: (
            <p className={styles.sectionText}>
                Al acceder y utilizar <span className={styles.highlight}>Manhwa Imperial</span>, disponible
                en manhwaimperial.site, usted acepta cumplir y estar sujeto a los presentes Términos de
                Servicio. Si no está de acuerdo con alguno de estos términos, le rogamos que no utilice la
                Plataforma.
            </p>
        ),
    },
    {
        num: '2',
        title: 'Descripción del Servicio',
        content: (
            <p className={styles.sectionText}>
                Manhwa Imperial es una plataforma de agregación de contenido que proporciona acceso a
                manhwas, webtoons y manhua traducidos al español. La Plataforma organiza e indexa contenido
                ya disponible públicamente en internet, proporcionando una interfaz de lectura optimizada.
            </p>
        ),
    },
    {
        num: '3',
        title: 'Uso Aceptable',
        content: (
            <>
                <p className={styles.sectionText}>Al usar la Plataforma, usted se compromete a:</p>
                <ul className={styles.sectionList}>
                    <li>No redistribuir, copiar o republicar el contenido de la Plataforma sin autorización.</li>
                    <li>No intentar acceder a áreas restringidas del sistema.</li>
                    <li>No utilizar bots, scrapers u otros medios automatizados para acceder al contenido.</li>
                    <li>No publicar contenido ofensivo, difamatorio o ilegal en los comentarios.</li>
                    <li>Respetar a otros usuarios y mantener un ambiente de comunidad positivo.</li>
                </ul>
            </>
        ),
    },
    {
        num: '4',
        title: 'Propiedad Intelectual',
        content: (
            <>
                <p className={styles.sectionText}>
                    Los manhwas, webtoons y manhua presentados en la Plataforma son propiedad de sus
                    respectivos <span className={styles.highlight}>autores, artistas y editores</span>.
                    Manhwa Imperial no reclama la propiedad sobre dicho contenido. La Plataforma funciona
                    como un servicio de agregación e indexación bajo los principios de la DMCA.
                </p>
                <p className={styles.sectionText}>
                    El diseño, código fuente, marca, logotipos y elementos visuales propios de la Plataforma
                    son propiedad de Manhwa Imperial y están protegidos por las leyes de propiedad intelectual
                    aplicables.
                </p>
            </>
        ),
    },
    {
        num: '5',
        title: 'Cumplimiento DMCA',
        content: (
            <p className={styles.sectionText}>
                Manhwa Imperial cumple con la{' '}
                <span className={styles.highlight}>Digital Millennium Copyright Act (DMCA)</span>. Los
                titulares de derechos de autor pueden solicitar la eliminación de contenido siguiendo el
                procedimiento establecido en nuestra{' '}
                <Link href="/dmca" className={styles.contactEmail}>
                    Política DMCA
                </Link>
                .
            </p>
        ),
    },
    {
        num: '6',
        title: 'Cuentas de Usuario',
        content: (
            <p className={styles.sectionText}>
                El registro es <span className={styles.highlight}>opcional</span> para la lectura básica.
                Los usuarios registrados obtienen funcionalidades adicionales como favoritos, historial y
                comentarios. El usuario es responsable de mantener la confidencialidad de sus credenciales.
            </p>
        ),
    },
    {
        num: '7',
        title: 'Contenido para Adultos',
        content: (
            <p className={styles.sectionText}>
                Cierto contenido en la Plataforma puede estar clasificado para mayores de edad. Al acceder a
                dicho contenido, el usuario confirma ser mayor de edad según la legislación de su país de
                residencia.
            </p>
        ),
    },
    {
        num: '8',
        title: 'Limitación de Responsabilidad',
        content: (
            <p className={styles.sectionText}>
                Manhwa Imperial proporciona el servicio &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos
                que el servicio sea ininterrumpido, seguro o libre de errores. En la máxima medida
                permitida por la ley aplicable, la Plataforma no será responsable por daños indirectos,
                incidentales o consecuentes.
            </p>
        ),
    },
    {
        num: '9',
        title: 'Publicidad',
        content: (
            <p className={styles.sectionText}>
                La Plataforma puede mostrar publicidad contextual no intrusiva para cubrir los costos
                operativos. Nos comprometemos a que la publicidad no interfiera significativamente con la
                experiencia de lectura.
            </p>
        ),
    },
    {
        num: '10',
        title: 'Modificaciones',
        content: (
            <p className={styles.sectionText}>
                Nos reservamos el derecho de modificar estos Términos en cualquier momento. Los cambios
                serán efectivos desde su publicación en la Plataforma. El uso continuado del servicio
                constituye aceptación de los términos modificados.
            </p>
        ),
    },
    {
        num: '11',
        title: 'Ley Aplicable',
        content: (
            <p className={styles.sectionText}>
                Estos términos se rigen por las leyes aplicables en la jurisdicción desde donde opera la
                Plataforma, sin perjuicio de las disposiciones sobre conflicto de leyes.
            </p>
        ),
    },
]

export default function TerminosPage() {
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
                        <span className={styles.badge}>📋 Legal</span>
                        <h1 className={styles.heroTitle}>Términos de Servicio</h1>
                        <div className={styles.heroMeta}>
                            <span className={styles.metaTag}>
                                <strong>Última actualización:</strong> Febrero 2026
                            </span>
                            <span className={styles.metaTag}>
                                <strong>Vigencia:</strong> Febrero 2026
                            </span>
                        </div>
                    </header>

                    {/* Secciones */}
                    <div className={styles.body}>
                        {sections.map((s) => (
                            <section key={s.num} className={styles.section}>
                                <div className={styles.sectionHeader}>
                                    <span className={styles.sectionNumber}>{s.num}</span>
                                    <h2 className={styles.sectionTitle}>{s.title}</h2>
                                </div>
                                {s.content}
                            </section>
                        ))}
                    </div>

                    {/* Contacto */}
                    <div className={styles.contactBox}>
                        <p className={styles.contactBoxTitle}>Contacto</p>
                        <p className={styles.sectionText}>
                            Para consultas sobre estos Términos de Servicio:
                        </p>
                        <a href="mailto:contacto@manhwaimperial.site" className={styles.contactEmail}>
                            contacto@manhwaimperial.site
                        </a>
                    </div>

                    {/* Links */}
                    <nav className={styles.footerLinks} aria-label="Páginas legales relacionadas">
                        <span className={styles.footerLinksTitle}>Páginas legales</span>
                        <div className={styles.footerLinksList}>
                            <Link href="/politica-de-privacidad" className={styles.footerLink}>
                                Política de Privacidad
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
