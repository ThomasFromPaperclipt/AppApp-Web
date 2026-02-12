'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import styles from '../signin/auth.module.css';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage(`Check ${email} for a reset link!`);
        } catch (err: any) {
            console.error("Reset password error:", err);
            const errorCode = err.code;
            let errorMessage = "Failed to send reset email. Please try again.";

            switch (errorCode) {
                case 'auth/invalid-email':
                    errorMessage = "That doesn't look like a valid email address.";
                    break;
                case 'auth/user-not-found':
                    // For security, standard practice is often to not reveal this, but
                    // if the app desires specific feedback (like mobile seems to), we can say:
                    errorMessage = "We couldn't find an account with that email.";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "Too many attempts. Please try again later.";
                    break;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={styles.main}>
            <div className={styles.container}>
                <div className={styles.card}>
                    <img src="/assets/hello.gif" alt="Hello" className={styles.logo} />

                    <h1 className={styles.title}>Forgot Password</h1>
                    <p className={styles.subtitle}>
                        Enter your email to receive a reset link
                    </p>

                    {error && <div className={styles.error}>{error}</div>}
                    {message && <div className={styles.error} style={{ backgroundColor: '#d1fae5', borderColor: '#34d399', color: '#065f46' }}>{message}</div>}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputGroup}>
                            <label htmlFor="email" className={styles.label}>
                                EMAIL
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                placeholder="name@example.com"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'sending...' : 'send reset link'}
                        </button>
                    </form>

                    <div className={styles.footer}>
                        <button
                            onClick={() => router.push('/auth/signin')}
                            className={styles.link}
                        >
                            Back to Log In
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}
