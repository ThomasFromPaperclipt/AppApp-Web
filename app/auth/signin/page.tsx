'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import app, { auth } from '@/lib/firebase';
import styles from './auth.module.css';

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Check user role (logic from LoginScreen.js)
            const db = getFirestore(app);
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                // If specific role logic is needed, add here.
                // Mobile app blocks parent/counselor on mobile, but this IS web.
                // So we allow everyone on web usually.
            }

            router.push('/dashboard');
        } catch (err: any) {
            console.error("Login error:", err);
            // ... (keep existing error handling or simplify?)
            // Mobile just says "Incorrect email or password".
            // Webster wants to keep the nice specific messages probably?
            // Actually, for security/consistency let's stick to the helpful messages we had, but maybe style them nicely.
            setError("Incorrect email or password"); // Matching mobile behavior for consistency as requested? 
            // "Like the login page on the mobile app but even better"
            // "Better" implies keeping the good error messages.

            // Let's keep the detailed error logic but maybe simplify the display
            const errorCode = err.code;
            let errorMessage = "Incorrect email or password"; // Default fallback

            switch (errorCode) {
                case 'auth/invalid-email':
                    errorMessage = "That doesn't look like a valid email address.";
                    break;
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    errorMessage = "Incorrect email or password.";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "Too many attempts. Please try again later.";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "This account has been disabled.";
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
                    {/* Logo */}
                    <img src="/assets/hello.gif" alt="Hello" className={styles.logo} />

                    <h1 className={styles.title}>Log In</h1>

                    {error && <div className={styles.error}>{error}</div>}

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
                                placeholder="Email"
                                required
                            />
                        </div>

                        <div className={styles.inputGroup}>
                            <label htmlFor="password" className={styles.label}>
                                PASSWORD
                            </label>
                            <div className={styles.passwordContainer}>
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className={styles.input}
                                    placeholder="Password"
                                    required
                                />
                                {/* Show/Hide Password Toggle */}
                                <button
                                    type="button"
                                    className={styles.toggleButton}
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? "Hide" : "Show"} Password
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? 'logging in...' : 'log in'}
                        </button>
                        <div className={styles.footer}>
                            <p>
                                New to AppApp?{' '}
                                <button
                                    onClick={() => router.push('/auth/signup')}
                                    className={styles.link}
                                >
                                    Sign up
                                </button>
                            </p>
                        </div>
                        {/* Forgot Password */}
                        <button
                            type="button"
                            className={styles.forgotPassword}
                            onClick={() => router.push('/auth/forgot-password')}
                        >
                            Forgot your password?
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
