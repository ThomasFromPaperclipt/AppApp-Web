'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import PublicFooter from '@/components/PublicFooter';
import styles from './page.module.css';

export default function Home() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isNeilHovered, setIsNeilHovered] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setUser(user);
            setLoading(false);
            if (user) {
                router.push('/dashboard');
            }
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
        return (
            <main className={styles.main}>
                <div className={styles.loading}>Loading...</div>
            </main>
        );
    }

    if (user) {
        return null;
    }

    return (
        <main className={styles.main}>
            {/* Hero Section with Navbar inside */}
            <section className={styles.heroSection}>
                {/* Navbar */}
                <nav className={styles.navbar}>
                    <div className={styles.logoContainer} onClick={() => router.push('/')} style={{ cursor: 'pointer' }}>
                        <img src="/assets/elongatedNeil.png" alt="AppApp Logo" className={styles.logoImage} />
                    </div>
                    <button
                        className={styles.navLoginButton}
                        onClick={() => router.push('/auth/signin')}
                    >
                        Log In
                    </button>
                </nav>

                <div className={styles.heroContentWrapper}>
                    <div className={styles.heroContent}>
                        <h1 className={styles.heroTitle}>No-stress college prep</h1>
                        <p className={styles.heroSubtitle}>
                            From freshman year to the moment you get that acceptance letter, AppApp’s by your side.
                        </p>
                        <div className={styles.heroButtons}>
                            <a
                                href="https://apps.apple.com/us/app/appapp-no-stress-college-prep/id6737578146"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.downloadButton}
                                style={{ textDecoration: 'none' }}
                            >
                                <span className="material-symbols-outlined">download</span>
                                Download on the App Store
                            </a>
                            <button
                                className={styles.webLoginButton}
                                onClick={() => router.push('/auth/signin')}
                            >
                                LOG IN
                            </button>
                        </div>
                    </div>
                    <div className={styles.heroImageContainer}>
                        <img
                            src={isNeilHovered ? "/assets/flyingAIsmile.png" : "/assets/flyingAI.png"}
                            alt="Neil flying"
                            className={styles.heroImage}
                            onMouseEnter={() => setIsNeilHovered(true)}
                            onMouseLeave={() => setIsNeilHovered(false)}
                        />
                    </div>
                </div>

                {/* Curve Divider */}
                <div className={styles.curveDivider}>
                    <svg data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                        <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" className={styles.shapeFill}></path>
                    </svg>
                </div>
            </section>

            {/* Screenshots Section */}
            <section className={styles.screenshotsSection}>
                {/* Mobile Carousel */}
                <div className={styles.carouselContainer}>
                    <h2 className={styles.carouselTitle}>Your pocket-sized college counselor</h2>
                    <div className={styles.carouselWrapper}>
                        <button
                            className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
                            onClick={() => {
                                const el = document.getElementById('mobileCarousel');
                                if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
                            }}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div id="mobileCarousel" className={styles.carouselScroll}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className={`${styles.screenshotCard} ${styles.mobileCard}`}>
                                    <span className={styles.placeholderText}>Mobile Screen {i}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
                            onClick={() => {
                                const el = document.getElementById('mobileCarousel');
                                if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
                            }}
                        >
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </div>

                {/* Web Carousel */}
                <div className={styles.carouselContainer} style={{ marginBottom: 0 }}>
                    <h2 className={styles.carouselTitle}>Powerful tools for the big screen</h2>
                    <div className={styles.carouselWrapper}>
                        <button
                            className={`${styles.carouselArrow} ${styles.carouselArrowLeft}`}
                            onClick={() => {
                                const el = document.getElementById('webCarousel');
                                if (el) el.scrollBy({ left: -600, behavior: 'smooth' });
                            }}
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div id="webCarousel" className={styles.carouselScroll}>
                            {[1, 2, 3].map((i) => (
                                <div key={i} className={`${styles.screenshotCard} ${styles.webCard}`}>
                                    <span className={styles.placeholderText}>Web Dashboard {i}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            className={`${styles.carouselArrow} ${styles.carouselArrowRight}`}
                            onClick={() => {
                                const el = document.getElementById('webCarousel');
                                if (el) el.scrollBy({ left: 600, behavior: 'smooth' });
                            }}
                        >
                            <span className="material-symbols-outlined">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className={styles.featuresSection}>
                <h2 className={styles.sectionTitle}>We Built AppApp for You!</h2>
                <div className={styles.featuresList}>
                    {/* Feature 1: AI Insights */}
                    <div className={styles.featureRow}>
                        <div className={styles.featureContent}>
                            <h3 className={styles.featureTitle}>Get AI-powered insights</h3>
                            <p className={styles.featureText}>
                                Neil analyzes your profile to give you personalized recommendations. The first day of every month is AppApp day, where you get a fresh Application Readiness Score and advice!
                            </p>
                        </div>
                        <div className={styles.featureImagePlaceholder}>
                            <img
                                src="/assets/flyingAI.png"
                                alt="Neil flying"
                                className={styles.featureImage}
                            />
                        </div>
                    </div>

                    {/* Feature 2: Resume */}
                    <div className={styles.featureRow}>
                        <div className={styles.featureContent}>
                            <h3 className={styles.featureTitle}>Download your resume</h3>
                            <p className={styles.featureText}>
                                Need a brag sheet for recommendation letters? Download all your activities, honors, and stats in a beautifully formatted PDF with just one tap.
                            </p>
                        </div>
                        <div className={styles.featureImagePlaceholder}>
                            <img
                                src="/assets/resume.png"
                                alt="Resume"
                                className={styles.featureImage}
                            />
                        </div>
                    </div>

                    {/* Feature 3: Essays */}
                    <div className={styles.featureRow}>
                        <div className={styles.featureContent}>
                            <h3 className={styles.featureTitle}>Essay triage</h3>
                            <p className={styles.featureText}>
                                We've built a unique system to help you organize your ideas and tackle them one at a time, with as little re-writing as possible!
                            </p>
                        </div>
                        <div className={styles.featureImagePlaceholder}>
                            <img
                                src="/assets/laptop.png"
                                alt="Essay image"
                                className={styles.featureImage}
                            />
                        </div>
                    </div>

                    {/* Feature 4: College Visits */}
                    <div className={styles.featureRow}>
                        <div className={styles.featureContent}>
                            <h3 className={styles.featureTitle}>Track college visits</h3>
                            <p className={styles.featureText}>
                                Organize your campus tours, information sessions, and other schools you're looking at. Keep notes on what you loved (or didn't) to help you make the big decision later.
                            </p>
                        </div>
                        <div className={styles.featureImagePlaceholder}>
                            <img
                                src="/assets/tour.png"
                                alt="Tour Image"
                                className={styles.featureImage}
                            />
                        </div>
                    </div>

                    {/* Feature 5: Common App */}
                    <div className={styles.featureRow}>
                        <div className={styles.featureContent}>
                            <h3 className={styles.featureTitle}>Plays well with the Common App</h3>
                            <p className={styles.featureText}>
                                We're not the Common App, but we make filling it out a breeze. All your data is organized exactly how you'll need it when application season starts.
                            </p>
                        </div>
                        <div className={styles.featureImagePlaceholder}>
                            <img
                                src="/assets/basketball.png"
                                alt="Plays Nicely Image"
                                className={styles.featureImage}
                            />
                        </div>
                    </div>
                    {/* Feature 6: SAT Prep */}
                    <div className={styles.featureRow}>
                        <div className={styles.featureContent}>
                            <h3 className={styles.featureTitle}>Free SAT prep</h3>
                            <p className={styles.featureText}>
                                Powerful test-prep resources to help you get the best scores you can!
                            </p>
                        </div>
                        <div className={styles.featureImagePlaceholder}>
                            <img
                                src="/assets/1600.png"
                                alt="SAT Image"
                                className={styles.featureImage}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* Free Section */}
            <section className={styles.freeSection}>
                <h2 className={styles.freeTitle}>Oh yeah, and it’s totally free.</h2>
                <p className={styles.freeText}>
                    AppApp is for everyone!
                </p>
                <div className={styles.heroButtons} style={{ margin: '0 auto' }}>
                    <a
                        href="http://localhost:3000/auth/signup"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.downloadButton}
                        style={{ textDecoration: 'none' }}
                    >
                        Get Started
                    </a>
                </div>
            </section>

            {/* Instagram Section */}
            <section className={styles.instagramSection}>
                <img src="/assets/instagram.png" alt="Instagram" className={styles.instagramImage} />
                <h2 className={styles.instagramTitle}>Follow us on Instagram</h2>
                <a
                    href="https://www.instagram.com/goappapp/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.instagramButton}
                >
                    @goappapp
                </a>
            </section>

            {/* Footer */}
            <PublicFooter />
        </main>
    );
}
