import Header from '@/components/Header'
import styles from '@/styles/legal.module.css'

export default function EnLegalNoticePage() {
  return (
    <>
      <Header lang="en" />
      <main className={styles.pageWrapper}>
        <div className={styles.content}>
          <header className={styles.hero}>
            <span className={styles.badge}>⚖️ Legal</span>
            <h1 className={styles.heroTitle}>Legal Notice</h1>
          </header>

          <div className={styles.body}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>1</span>
                <h2 className={styles.sectionTitle}>Website Information</h2>
              </div>
              <p className={styles.sectionText}>
                This website is operated by Manhwa Imperial. Domain: manhwaimperial.site
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>2</span>
                <h2 className={styles.sectionTitle}>Purpose</h2>
              </div>
              <p className={styles.sectionText}>
                Manhwa Imperial is a platform for reading manhwa, webtoons, and manga. We operate as a
                content aggregation service, organizing and indexing publicly available content.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>3</span>
                <h2 className={styles.sectionTitle}>Copyright Compliance</h2>
              </div>
              <p className={styles.sectionText}>
                Manhwa Imperial complies with the Digital Millennium Copyright Act (DMCA). We maintain
                an active notice and takedown system for copyright claims. All legitimate requests
                are processed within 24-48 business hours.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>4</span>
                <h2 className={styles.sectionTitle}>Liability Disclaimer</h2>
              </div>
              <p className={styles.sectionText}>
                The information provided on this website is for general informational purposes only.
                While we strive for accuracy, we make no guarantees about the completeness, reliability,
                or accuracy of this information.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>5</span>
                <h2 className={styles.sectionTitle}>External Links</h2>
              </div>
              <p className={styles.sectionText}>
                This website may contain links to external websites. We are not responsible for the
                content, privacy policies, or practices of third-party websites.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>6</span>
                <h2 className={styles.sectionTitle}>Contact Information</h2>
              </div>
              <p className={styles.sectionText}>
                For legal inquiries:
              </p>
              <p className={styles.sectionText}>
                <strong>General:</strong> contacto@manhwaimperial.site<br />
                <strong>DMCA:</strong> dmca@manhwaimperial.site
              </p>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
