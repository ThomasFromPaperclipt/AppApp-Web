'use client';

import { useState } from 'react';
import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import styles from '../PublicPages.module.css';

export default function Contact() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = encodeURIComponent('Contact Form Submission from ' + formData.name);
        const body = encodeURIComponent(`Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`);
        window.location.href = `mailto:developer@goappapp.com,hello@goappapp.com?subject=${subject}&body=${body}`;
    };

    return (
        <main className={styles.pageContainer}>
            <PublicNavbar />

            <div className={styles.mainContent}>
                <h1 className={styles.title}>Contact Us</h1>

                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Get in Touch</h2>
                    <p className={styles.text}>
                        We'd love to hear from you! Fill out the form below or email us directly at <a href="mailto:hello@goappapp.com" style={{ color: '#007bff', textDecoration: 'underline' }}>hello@goappapp.com</a>.
                    </p>

                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="name">Name</label>
                            <input
                                type="text"
                                id="name"
                                className={styles.input}
                                placeholder="Your Name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                className={styles.input}
                                placeholder="your@email.com"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label} htmlFor="message">Message</label>
                            <textarea
                                id="message"
                                className={styles.textarea}
                                placeholder="How can we help?"
                                value={formData.message}
                                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                required
                            ></textarea>
                        </div>

                        <button type="submit" className={styles.submitButton}>Send Message</button>
                    </form>
                </section>
            </div>

            <PublicFooter />
        </main>
    );
}
