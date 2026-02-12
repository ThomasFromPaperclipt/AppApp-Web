'use client';

import { useEffect, useState } from 'react';
import styles from './download.module.css';

export default function DownloadPage() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {/* Header Section */}
                <div className={`${styles.header} ${mounted ? styles.fadeIn : ''}`}>
                    <img
                        src="/assets/elongatedNeil.png"
                        alt="AppApp"
                        className={styles.headerLogo}
                    />
                    <p className={styles.subtitle}>Your college application journey starts here.</p>
                </div>

                {/* Bento Grid Layout */}
                <div className={styles.bentoGrid}>

                    {/* Preview Widget (Phone) - Spans 2 columns on mobile if needed, or full width */}
                    <div className={`${styles.widget} ${styles.previewWidget} ${mounted ? styles.slideUp : ''}`} style={{ animationDelay: '0.1s' }}>
                        <div className={styles.previewContent}>
                            <div className={styles.previewText}>
                                <h3>Totally Free.</h3>
                                <p>AI tools, stats tracking, and more.</p>
                            </div>
                            <div className={styles.phoneContainer}>
                                <img
                                    src="/assets/flyingAI.png"
                                    alt="AppApp AI"
                                    className={styles.phoneImage}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Primary Action: App Store - Full Width */}
                    <a
                        href="https://apps.apple.com/app/appapp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${styles.widget} ${styles.primaryWidget} ${mounted ? styles.slideUp : ''}`}
                        style={{ animationDelay: '0.2s' }}
                    >
                        <div className={styles.widgetIcon}>
                            <span className="material-symbols-outlined">download</span>
                        </div>
                        <div className={styles.widgetText}>
                            <h3>Download on the App Store</h3>
                            <p>Get the full experience</p>
                        </div>
                        <div className={styles.arrowIcon}>
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </div>
                    </a>

                    {/* Secondary Grid: Instagram & Android */}
                    <div className={styles.secondaryRow}>
                        <a
                            href="https://instagram.com/goappapp"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.widget} ${styles.secondaryWidget} ${styles.instaWidget} ${mounted ? styles.slideUp : ''}`}
                            style={{ animationDelay: '0.3s' }}
                        >
                            <div className={styles.widgetIconSmall}>
                                <span className="material-symbols-outlined">photo_camera</span>
                            </div>
                            <h3>Instagram</h3>
                        </a>

                        <a
                            href="https://forms.gle/android-waitlist"
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${styles.widget} ${styles.secondaryWidget} ${styles.androidWidget} ${mounted ? styles.slideUp : ''}`}
                            style={{ animationDelay: '0.4s' }}
                        >
                            <div className={styles.widgetIconSmall}>
                                <span className="material-symbols-outlined">android</span>
                            </div>
                            <h3>Android Waitlist</h3>
                        </a>
                    </div>



                </div>
                {/* Footer Link */}
                <div className={styles.footer}>
                    <a href="/auth/signup" className={styles.footerLink}>
                        Create an account <span className={styles.arrow}>→</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
