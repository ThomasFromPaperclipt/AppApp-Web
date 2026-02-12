'use client';

import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import styles from '../PublicPages.module.css';

export default function Resources() {
    return (
        <main className={styles.pageContainer}>
            <PublicNavbar />

            <div className={styles.mainContent}>
                <h1 className={styles.title}>Resources</h1>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>College Planning Guides</h2>
                    <p className={styles.text}>
                        Explore our comprehensive guides to help you navigate every step of the college application process.
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>Freshman Year Checklist</li>
                        <li className={styles.listItem}>Sophomore Year: Building Your Profile</li>
                        <li className={styles.listItem}>Junior Year: Standardized Testing & Search</li>
                        <li className={styles.listItem}>Senior Year: Applications & Financial Aid</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Essay Writing Tips</h2>
                    <p className={styles.text}>
                        Learn how to craft compelling personal statements and supplemental essays that stand out to admissions officers.
                    </p>
                    <ul className={styles.list}>
                        <li className={styles.listItem}>Deconstructing the Common App Prompts</li>
                        <li className={styles.listItem}>How to Brainstorm Unique Topics</li>
                        <li className={styles.listItem}>Editing and Polishing Your Drafts</li>
                    </ul>
                </section>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Financial Aid & Scholarships</h2>
                    <p className={styles.text}>
                        Understand FAFSA, CSS Profile, and how to find scholarships to fund your education.
                    </p>
                </section>
            </div>

            <PublicFooter />
        </main>
    );
}
