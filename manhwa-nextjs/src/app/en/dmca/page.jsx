import Header from '@/components/Header'
import Footer from '@/components/Footer'
import styles from '../../(es)/dmca/Dmca.module.css'

export default function EnDMCAPage() {
  return (
    <>
      <Header lang="en" />
      <main className={styles.container}>
        <div className={styles.content}>
          <h1 className={styles.title}>DMCA Policy</h1>
          
          <section className={styles.section}>
            <h2>Copyright Policy</h2>
            <p>
              Manhwa Imperial respects the intellectual property rights of others and expects its users to do the same.
              In accordance with the Digital Millennium Copyright Act of 1998 (DMCA), we will respond expeditiously
              to claims of copyright infringement committed using our website.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Filing a DMCA Notice</h2>
            <p>
              If you are a copyright owner, or authorized to act on behalf of one, and believe that your copyrighted
              work has been copied in a way that constitutes copyright infringement, please submit your claim via email to:
            </p>
            <p className={styles.highlight}>
              <strong>dmca@manhwaimperial.site</strong>
            </p>
            <p>Your DMCA notice must include:</p>
            <ul>
              <li>A physical or electronic signature of the copyright owner or authorized person</li>
              <li>Identification of the copyrighted work claimed to have been infringed</li>
              <li>Identification of the material that is claimed to be infringing with sufficient detail for us to locate it</li>
              <li>Your contact information (address, telephone number, and email address)</li>
              <li>A statement that you have a good faith belief that use of the material is not authorized</li>
              <li>A statement that the information in the notification is accurate, and under penalty of perjury, that you are authorized to act on behalf of the copyright owner</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Response Time</h2>
            <p>
              We process all valid DMCA notices within <strong>24-48 business hours</strong>.
              Upon receiving a proper DMCA notice, we will remove or disable access to the allegedly infringing material
              and notify the user who posted it.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Counter-Notification</h2>
            <p>
              If you believe that your content was removed by mistake or misidentification, you may file a counter-notification.
              Your counter-notification must include:
            </p>
            <ul>
              <li>Your physical or electronic signature</li>
              <li>Identification of the material that has been removed</li>
              <li>A statement under penalty of perjury that you have a good faith belief the material was removed by mistake</li>
              <li>Your name, address, telephone number, and a statement that you consent to jurisdiction of Federal District Court</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Contact</h2>
            <p>For all DMCA-related inquiries:</p>
            <p className={styles.highlight}>
              <strong>Email:</strong> dmca@manhwaimperial.site
            </p>
          </section>
        </div>
      </main>
      <Footer lang="en" />
    </>
  )
}
