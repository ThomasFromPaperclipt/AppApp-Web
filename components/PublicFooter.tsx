'use client';

import styles from '../app/PublicPages.module.css';

export default function PublicFooter() {
    return (
        <footer className={styles.footer}>
            <div className={styles.footerContent}>
                <div className={styles.logoContainer} style={{ display: 'inline-flex' }}>
                    <img src="/assets/elongated.png" alt="AppApp" className={styles.logoImage} />
                </div>
                <div className={styles.footerLinks}>
                    <a href="/resources" className={styles.footerLink}>Resources</a>
                    <a href="/help" className={styles.footerLink}>Help</a>
                    <a href="/contact" className={styles.footerLink}>Contact</a>
                    <a href="/privacy-policy" className={styles.footerLink}>Privacy Policy</a>
                    <a href="/terms-of-use" className={styles.footerLink}>Terms of Use</a>
                </div>
                <p className={styles.copyright}>
                    © Copyright 2025 Paperclipt, LLC. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
