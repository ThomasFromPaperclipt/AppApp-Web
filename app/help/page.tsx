'use client';

import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import styles from '../PublicPages.module.css';

export default function Help() {
    return (
        <main className={styles.pageContainer}>
            <PublicNavbar />

            <div className={styles.mainContent}>
                <h1 className={styles.title}>Help Center</h1>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Frequently Asked Questions</h2>

                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '10px' }}>How do I reset my password?</h3>
                        <p className={styles.text}>
                            You can reset your password by clicking on the "Forgot Password" link on the login page. Follow the instructions sent to your email.
                        </p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '10px' }}>Is AppApp really free?</h3>
                        <p className={styles.text}>
                            Yes! AppApp is completely free to use for students. We believe in accessible college counseling for everyone.
                        </p>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '10px' }}>How do I contact support?</h3>
                        <p className={styles.text}>
                            If you can't find the answer you're looking for, please visit our Contact page or email us at support@goappapp.com.
                        </p>
                    </div>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>User Guides</h2>
                    <p className={styles.text}>
                        Detailed walkthroughs on how to use AppApp's features, from the Dashboard to the Essay Generator.
                    </p>
                    <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                        <iframe
                            width="315"
                            height="560"
                            src="https://www.youtube.com/embed/AN3LN8Hxxq0"
                            title="YouTube video player"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        ></iframe>
                    </div>
                </section>
            </div>

            <PublicFooter />
        </main>
    );
}
