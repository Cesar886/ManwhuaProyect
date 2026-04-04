import Link from 'next/link'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { SITE_URL, SITE_NAME } from '@/config'
import styles from '@/styles/legal.module.css'
import { generateAboutPageFAQJsonLd } from '@/lib/seo/jsonld'

const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${SITE_URL}/en/about#webpage`,
    name: `About ${SITE_NAME}`,
    url: `${SITE_URL}/en/about`,
    description:
        'Information about Manhwa Imperial, its artificial intelligence, mission, legal model and commitment to creators. Manhwa Imperial is an AI-powered platform.',
    inLanguage: 'en',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    mainEntity: {
        '@id': `${SITE_URL}/#organization`,
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
        description:
            'Leading manhwa reading platform powered by artificial intelligence. AI-powered search, active DMCA compliance and commitment to legality.',
        ethicsPolicy: `${SITE_URL}/en/dmca`,
        publishingPrinciples: `${SITE_URL}/en/terms-of-service`,
    },
}

const commitments = [
    {
        icon: '⚖️',
        title: 'Active DMCA Compliance',
        text: 'We maintain a notice and takedown system that processes requests within 24–48 business hours.',
    },
    {
        icon: '📋',
        title: 'Transparent Policies',
        text: 'All our legal documents are published and accessible to anyone.',
    },
    {
        icon: '❤️',
        title: 'Support for Creators',
        text: 'We actively promote that users buy official works and link to platforms like Webtoon, Tappytoon and Lezhin.',
    },
    {
        icon: '📬',
        title: 'Designated DMCA Agent',
        text: 'We have a dedicated contact point for copyright claims: dmca@manhwaimperial.site',
    },
]

const safetyPoints = [
    'Encrypted HTTPS connection throughout the site',
    'No software downloads required',
    'No malware or malicious pop-ups',
    'Respect for each user\'s privacy',
    'No invasive tracking of personal data',
]

export const metadata = {
  title: 'About Us - Manhwa Imperial',
  description: 'Learn about Manhwa Imperial, our AI-powered platform, mission, legal commitment and support for creators.',
    alternates: {
        canonical: '/en/about',
        languages: {
            es: '/acerca-de',
            en: '/en/about',
        },
    },
}

export default function AboutEnPage() {
    return (
        <>
            <Header lang="en" />
            <main className={styles.pageWrapper}>
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(generateAboutPageFAQJsonLd('en')) }}
                />

                <div className={styles.content}>
                    <header className={styles.hero}>
                        <span className={styles.badge}>🏯 About Us</span>
                        <h1 className={styles.heroTitle}>About Manhwa Imperial</h1>
                        <div className={styles.heroMeta}>
                            <span className={styles.metaTag}>The #1 manhwa platform</span>
                        </div>
                    </header>

                    <div className={styles.body}>
                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>1</span>
                                <h2 className={styles.sectionTitle}>Our Mission</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Manhwa Imperial was born with the mission to be the best platform to
                                enjoy manhwas, webtoons and manhua. We believe the community
                                deserves access to a <span className={styles.highlight}>high-quality</span> platform,
                                with a modern interface, careful translations and a genuine commitment to legality
                                and creator rights.
                            </p>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>2</span>
                                <h2 className={styles.sectionTitle}>How We Operate</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Manhwa Imperial functions as a{' '}
                                <span className={styles.highlight}>content aggregation platform</span>.
                                This means we organize and index manhwas already publicly available on
                                the internet, providing a superior reading experience. Our model is
                                similar to other recognized content aggregators on the internet.
                            </p>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>3</span>
                                <h2 className={styles.sectionTitle}>Our Legal Commitment</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Legality and respect for copyright are fundamental pillars of
                                Manhwa Imperial:
                            </p>
                            <ul className={styles.sectionList}>
                                {commitments.map((c) => (
                                    <li key={c.title}>
                                        <span aria-hidden="true">{c.icon}</span>
                                        <span>
                                            <span className={styles.highlight}>{c.title}:</span> {c.text}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>4</span>
                                <h2 className={styles.sectionTitle}>Commitment to Security</h2>
                            </div>
                            <p className={styles.sectionText}>
                                The security of our users is paramount. Manhwa Imperial guarantees:
                            </p>
                            <ul className={styles.sectionList}>
                                {safetyPoints.map((p) => (
                                    <li key={p}>{p}</li>
                                ))}
                            </ul>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>5</span>
                                <h2 className={styles.sectionTitle}>Community Support</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Manhwa Imperial is more than a reading platform — it&apos;s a{' '}
                                <span className={styles.highlight}>community</span>. We offer comment system,
                                series and chapter ratings, new title requests voted by the community,
                                and a space where manhwa lovers can connect and share their passion.
                            </p>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>6</span>
                                <h2 className={styles.sectionTitle}>Artificial Intelligence at Manhwa Imperial</h2>
                            </div>
                            <p className={styles.sectionText}>
                                Manhwa Imperial is an{' '}
                                <span className={styles.highlight}>AI-powered platform</span>.
                                Our AI search allows readers to find manhwas in ways that would be
                                impossible with a traditional search:
                            </p>
                            <ul className={styles.sectionList}>
                                <li>
                                    <span className={styles.highlight}>Natural language search:</span> write what you&apos;re looking for as you would tell a friend. The AI understands complete sentences
                                </li>
                                <li>
                                    <span className={styles.highlight}>Automatic error correction:</span> the AI corrects spelling errors and romanization variations of Korean names
                                </li>
                                <li>
                                    <span className={styles.highlight}>Plot description search:</span> if you forgot the name of a manhwa, describe what you remember and the AI identifies it
                                </li>
                                <li>
                                    <span className={styles.highlight}>Smart recommendations:</span> ask for something similar to a manhwa you liked and the AI finds titles with similar narrative elements
                                </li>
                                <li>
                                    <span className={styles.highlight}>Emotion-based search:</span> the AI understands searches like &quot;something relaxing&quot; or &quot;pure action without romance&quot;
                                </li>
                            </ul>
                            <div className={styles.infoBox}>
                                <p>
                                    The AI is available in the <strong>floating chat</strong> visible throughout the site
                                    and in the <strong>main search bar</strong>. Read more about how it works in{' '}
                                    <Link href="/blog/busqueda-inteligente-ia-manhwa-imperial">our article about Manhwa Imperial&apos;s AI</Link>.
                                </p>
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <span className={styles.sectionNumber}>7</span>
                                <h2 className={styles.sectionTitle}>Is Manhwa Imperial Legal?</h2>
                            </div>
                            <div className={styles.infoBox}>
                                <p>
                                    <strong>Yes.</strong> Manhwa Imperial operates within the legal framework established
                                    by the{' '}
                                    <strong>Digital Millennium Copyright Act (DMCA)</strong>. We maintain an
                                    active notice and takedown system, respond to all legitimate
                                    rights holder requests, and actively promote support for
                                    original creators. Our legal policies are publicly available
                                    for review.
                                </p>
                            </div>
                        </section>
                    </div>

                    <div className={styles.contactBox}>
                        <p className={styles.contactBoxTitle}>Contact</p>
                        <p className={styles.sectionText} style={{ marginBottom: '6px' }}>
                            General inquiries:
                        </p>
                        <a href="mailto:contacto@manhwaimperial.site" className={styles.contactEmail}>
                            contacto@manhwaimperial.site
                        </a>
                        <p className={styles.sectionText} style={{ marginTop: '10px', marginBottom: '6px' }}>
                            DMCA claims:
                        </p>
                        <a href="mailto:dmca@manhwaimperial.site" className={styles.contactEmail}>
                            dmca@manhwaimperial.site
                        </a>
                    </div>

                    <nav className={styles.footerLinks} aria-label="Related pages">
                        <span className={styles.footerLinksTitle}>More information</span>
                        <div className={styles.footerLinksList}>
                            <Link href="/en/dmca" className={styles.footerLink}>
                                DMCA Policy
                            </Link>
                            <Link href="/en/terms-of-service" className={styles.footerLink}>
                                Terms of Service
                            </Link>
                            <Link href="/en/privacy-policy" className={styles.footerLink}>
                                Privacy Policy
                            </Link>
                            <Link href="/en/legal-notice" className={styles.footerLink}>
                                Legal Notice
                            </Link>
                        </div>
                    </nav>
                </div>
            </main>
            <Footer lang="en" />
        </>
    )
}
