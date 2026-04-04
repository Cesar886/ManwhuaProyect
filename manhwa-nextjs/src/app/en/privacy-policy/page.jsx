import Header from '@/components/Header'
import Footer from '@/components/Footer'
import styles from '@/styles/legal.module.css'

export default function EnPrivacyPage() {
  return (
    <>
      <Header lang="en" />
      <main className={styles.pageWrapper}>
        <div className={styles.content}>
          <header className={styles.hero}>
            <span className={styles.badge}>🔒 Privacy</span>
            <h1 className={styles.heroTitle}>Privacy Policy</h1>
          </header>

          <div className={styles.body}>
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>1</span>
                <h2 className={styles.sectionTitle}>Information We Collect</h2>
              </div>
              <p className={styles.sectionText}>
                Manhwa Imperial collects minimal user information to provide our services:
              </p>
              <ul className={styles.sectionList}>
                <li>Account information (email, username) if you create an account</li>
                <li>Usage data (pages visited, reading preferences)</li>
                <li>Device information (browser type, IP address)</li>
                <li>Cookies for session management and preferences</li>
              </ul>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>2</span>
                <h2 className={styles.sectionTitle}>How We Use Your Information</h2>
              </div>
              <p className={styles.sectionText}>
                We use collected information to:
              </p>
              <ul className={styles.sectionList}>
                <li>Provide and improve our services</li>
                <li>Remember your reading preferences</li>
                <li>Analyze usage patterns to enhance user experience</li>
                <li>Communicate important updates about the service</li>
              </ul>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>3</span>
                <h2 className={styles.sectionTitle}>Data Sharing</h2>
              </div>
              <p className={styles.sectionText}>
                We do not sell your personal information. We may share data with:
              </p>
              <ul className={styles.sectionList}>
                <li>Service providers who help operate our platform</li>
                <li>Analytics services (Google Analytics) to understand usage</li>
                <li>Legal authorities when required by law</li>
              </ul>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>4</span>
                <h2 className={styles.sectionTitle}>Cookies</h2>
              </div>
              <p className={styles.sectionText}>
                We use cookies to enhance your experience. You can control cookie preferences through your
                browser settings, though some features may not work properly if cookies are disabled.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>5</span>
                <h2 className={styles.sectionTitle}>Your Rights</h2>
              </div>
              <p className={styles.sectionText}>
                You have the right to:
              </p>
              <ul className={styles.sectionList}>
                <li>Access your personal data</li>
                <li>Request deletion of your account and data</li>
                <li>Opt out of marketing communications</li>
                <li>Update your information</li>
              </ul>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>6</span>
                <h2 className={styles.sectionTitle}>Security</h2>
              </div>
              <p className={styles.sectionText}>
                We implement appropriate security measures to protect your data. However, no method of
                transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionNumber}>7</span>
                <h2 className={styles.sectionTitle}>Contact</h2>
              </div>
              <p className={styles.sectionText}>
                For privacy-related questions:
              </p>
              <p className={styles.sectionText}>
                <strong>Email:</strong> contacto@manhwaimperial.site
              </p>
            </section>
          </div>
        </div>
      </main>
      <Footer lang="en" />
    </>
  )
}
