import Header from '@/components/Header'
import styles from '@/styles/legal.module.css'

export default function EnTermsPage() {
  return (
    <>
      <Header lang="en" />
      <main className={styles.pageWrapper}>
        <div className={styles.content}>
          <header className={styles.hero}>
            <span className={styles.badge}>📜 Legal</span>
            <h1 className={styles.heroTitle}>Terms of Service</h1>
          </header>

          <div className={styles.body}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>1</span>
                <h2 className={styles.sectionTitle}>Acceptance of Terms</h2>
              </div>
              <p className={styles.sectionText}>
                By accessing and using Manhwa Imperial, you accept and agree to be bound by these Terms of Service.
                If you do not agree to these terms, please do not use our platform.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>2</span>
                <h2 className={styles.sectionTitle}>Use of Service</h2>
              </div>
              <p className={styles.sectionText}>
                Manhwa Imperial provides a platform for reading manhwa, webtoons, and manga. Users must:
              </p>
              <ul className={styles.sectionList}>
                <li>Be at least 13 years old to use this service</li>
                <li>Not use the service for any illegal purposes</li>
                <li>Not attempt to interfere with the proper working of the service</li>
                <li>Respect the intellectual property rights of content creators</li>
              </ul>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>3</span>
                <h2 className={styles.sectionTitle}>Content</h2>
              </div>
              <p className={styles.sectionText}>
                Manhwa Imperial acts as a content aggregation platform. We do not host content directly,
                but organize and index publicly available content. We maintain an active DMCA compliance
                system and respond to all legitimate takedown requests.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>4</span>
                <h2 className={styles.sectionTitle}>User Conduct</h2>
              </div>
              <p className={styles.sectionText}>
                Users agree not to:
              </p>
              <ul className={styles.sectionList}>
                <li>Post harmful, threatening, abusive, or offensive content</li>
                <li>Impersonate any person or entity</li>
                <li>Attempt to gain unauthorized access to any part of the service</li>
                <li>Upload viruses or malicious code</li>
              </ul>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>5</span>
                <h2 className={styles.sectionTitle}>Disclaimer</h2>
              </div>
              <p className={styles.sectionText}>
                The service is provided &quot;as is&quot; without warranties of any kind. Manhwa Imperial does not
                guarantee the accuracy, completeness, or usefulness of any information on the site.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>6</span>
                <h2 className={styles.sectionTitle}>Changes to Terms</h2>
              </div>
              <p className={styles.sectionText}>
                We reserve the right to modify these terms at any time. Continued use of the service
                after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>7</span>
                <h2 className={styles.sectionTitle}>Contact</h2>
              </div>
              <p className={styles.sectionText}>
                For questions about these Terms of Service:
              </p>
              <p className={styles.sectionText}>
                <strong>Email:</strong> contacto@manhwaimperial.site
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
